/**
 * Cloud Function to monitor GCP free tier usage
 * Deploys as a scheduled function to check usage and send alerts
 */

const { CloudRunClient } = require('@google-cloud/run');
const { Storage } = require('@google-cloud/storage');
const { MetricServiceClient } = require('@google-cloud/monitoring');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { InstancesClient } = require('@google-cloud/compute');

// Initialize clients
const runClient = new CloudRunClient();
const storage = new Storage();
const metricsClient = new MetricServiceClient();
const secretClient = new SecretManagerServiceClient();
const computeClient = new InstancesClient();

// Configuration
const PROJECT_ID = process.env.PROJECT_ID || 'email-ai-assistant';
const REGION = process.env.REGION || 'us-central1';
const BUCKET_NAME = `${PROJECT_ID}-backups`;
const SERVICE_NAME = 'email-ai-api';
const VM_NAME = 'whatsapp-bot';
const ZONE = 'us-central1-a';

// Free tier limits
const FREE_TIER_LIMITS = {
  cloudRun: {
    requests: 2000000, // 2M per month
    cpu: 180000, // 180,000 vCPU-seconds per month
    memory: 360000, // 360,000 GB-seconds per month
  },
  storage: {
    bytes: 5 * 1024 * 1024 * 1024, // 5GB
    operations: 50000, // 50,000 operations per month
  },
  secretManager: {
    secrets: 6,
    accessOperations: 10000, // 10,000 per month
  },
  compute: {
    e2MicroHours: 744, // 744 hours per month (1 instance)
  },
};

/**
 * Get Cloud Run usage metrics
 */
async function getCloudRunUsage() {
  const projectPath = `projects/${PROJECT_ID}`;
  
  // Define time range (current month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endTime = now.toISOString();
  const startTime = startOfMonth.toISOString();
  
  const interval = {
    startTime: { seconds: Math.floor(startOfMonth.getTime() / 1000) },
    endTime: { seconds: Math.floor(now.getTime() / 1000) },
  };
  
  // Get request count
  const requestFilter = `
    resource.type="cloud_run_revision"
    resource.labels.service_name="${SERVICE_NAME}"
    metric.type="run.googleapis.com/request_count"
  `;
  
  const requestCountRequest = {
    name: projectPath,
    filter: requestFilter,
    interval: interval,
    aggregation: {
      alignmentPeriod: { seconds: 86400 }, // 1 day
      perSeriesAligner: 'ALIGN_SUM',
      crossSeriesReducer: 'REDUCE_SUM',
    },
  };
  
  let totalRequests = 0;
  try {
    const [requestTimeSeries] = await metricsClient.listTimeSeries(requestCountRequest);
    
    for (const series of requestTimeSeries) {
      for (const point of series.points) {
        totalRequests += point.value.int64Value || 0;
      }
    }
  } catch (error) {
    console.error('Error fetching request metrics:', error);
  }
  
  // Get CPU usage
  const cpuFilter = `
    resource.type="cloud_run_revision"
    resource.labels.service_name="${SERVICE_NAME}"
    metric.type="run.googleapis.com/container/cpu/allocation_time"
  `;
  
  const cpuRequest = {
    name: projectPath,
    filter: cpuFilter,
    interval: interval,
    aggregation: {
      alignmentPeriod: { seconds: 86400 },
      perSeriesAligner: 'ALIGN_SUM',
      crossSeriesReducer: 'REDUCE_SUM',
    },
  };
  
  let totalCpuSeconds = 0;
  try {
    const [cpuTimeSeries] = await metricsClient.listTimeSeries(cpuRequest);
    
    for (const series of cpuTimeSeries) {
      for (const point of series.points) {
        totalCpuSeconds += point.value.doubleValue || 0;
      }
    }
  } catch (error) {
    console.error('Error fetching CPU metrics:', error);
  }
  
  // Get memory usage
  const memoryFilter = `
    resource.type="cloud_run_revision"
    resource.labels.service_name="${SERVICE_NAME}"
    metric.type="run.googleapis.com/container/memory/allocation_time"
  `;
  
  const memoryRequest = {
    name: projectPath,
    filter: memoryFilter,
    interval: interval,
    aggregation: {
      alignmentPeriod: { seconds: 86400 },
      perSeriesAligner: 'ALIGN_SUM',
      crossSeriesReducer: 'REDUCE_SUM',
    },
  };
  
  let totalMemoryGbSeconds = 0;
  try {
    const [memoryTimeSeries] = await metricsClient.listTimeSeries(memoryRequest);
    
    for (const series of memoryTimeSeries) {
      for (const point of series.points) {
        totalMemoryGbSeconds += (point.value.doubleValue || 0) / (1024 * 1024 * 1024);
      }
    }
  } catch (error) {
    console.error('Error fetching memory metrics:', error);
  }
  
  return {
    requests: {
      used: totalRequests,
      limit: FREE_TIER_LIMITS.cloudRun.requests,
      percentage: (totalRequests / FREE_TIER_LIMITS.cloudRun.requests) * 100,
    },
    cpu: {
      used: totalCpuSeconds,
      limit: FREE_TIER_LIMITS.cloudRun.cpu,
      percentage: (totalCpuSeconds / FREE_TIER_LIMITS.cloudRun.cpu) * 100,
    },
    memory: {
      used: totalMemoryGbSeconds,
      limit: FREE_TIER_LIMITS.cloudRun.memory,
      percentage: (totalMemoryGbSeconds / FREE_TIER_LIMITS.cloudRun.memory) * 100,
    },
  };
}

/**
 * Get Cloud Storage usage
 */
async function getStorageUsage() {
  try {
    const [files] = await storage.bucket(BUCKET_NAME).getFiles();
    
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += parseInt(file.metadata.size || 0);
    }
    
    return {
      used: totalBytes,
      limit: FREE_TIER_LIMITS.storage.bytes,
      percentage: (totalBytes / FREE_TIER_LIMITS.storage.bytes) * 100,
      fileCount: files.length,
    };
  } catch (error) {
    console.error('Error fetching storage metrics:', error);
    return {
      used: 0,
      limit: FREE_TIER_LIMITS.storage.bytes,
      percentage: 0,
      fileCount: 0,
    };
  }
}

/**
 * Get VM uptime
 */
async function getVMUptime() {
  const projectPath = `projects/${PROJECT_ID}`;
  
  // Get current month's uptime
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const interval = {
    startTime: { seconds: Math.floor(startOfMonth.getTime() / 1000) },
    endTime: { seconds: Math.floor(now.getTime() / 1000) },
  };
  
  const filter = `
    resource.type="gce_instance"
    resource.labels.instance_name="${VM_NAME}"
    metric.type="compute.googleapis.com/instance/uptime"
  `;
  
  const request = {
    name: projectPath,
    filter: filter,
    interval: interval,
    aggregation: {
      alignmentPeriod: { seconds: 3600 }, // 1 hour
      perSeriesAligner: 'ALIGN_MAX',
    },
  };
  
  let totalUptimeHours = 0;
  try {
    const [timeSeries] = await metricsClient.listTimeSeries(request);
    
    for (const series of timeSeries) {
      totalUptimeHours += series.points.length; // Each point represents an hour
    }
  } catch (error) {
    console.error('Error fetching VM uptime:', error);
  }
  
  return {
    used: totalUptimeHours,
    limit: FREE_TIER_LIMITS.compute.e2MicroHours,
    percentage: (totalUptimeHours / FREE_TIER_LIMITS.compute.e2MicroHours) * 100,
  };
}

/**
 * Get Secret Manager usage
 */
async function getSecretManagerUsage() {
  const projectPath = `projects/${PROJECT_ID}`;
  
  // Count secrets
  let secretCount = 0;
  try {
    const [secrets] = await secretClient.listSecrets({
      parent: projectPath,
    });
    secretCount = secrets.length;
  } catch (error) {
    console.error('Error listing secrets:', error);
  }
  
  // Get access count for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const interval = {
    startTime: { seconds: Math.floor(startOfMonth.getTime() / 1000) },
    endTime: { seconds: Math.floor(now.getTime() / 1000) },
  };
  
  const filter = `
    resource.type="secretmanager.googleapis.com/Secret"
    metric.type="secretmanager.googleapis.com/secret/access_count"
  `;
  
  const request = {
    name: projectPath,
    filter: filter,
    interval: interval,
    aggregation: {
      alignmentPeriod: { seconds: 86400 },
      perSeriesAligner: 'ALIGN_SUM',
      crossSeriesReducer: 'REDUCE_SUM',
    },
  };
  
  let totalAccesses = 0;
  try {
    const [timeSeries] = await metricsClient.listTimeSeries(request);
    
    for (const series of timeSeries) {
      for (const point of series.points) {
        totalAccesses += point.value.int64Value || 0;
      }
    }
  } catch (error) {
    console.error('Error fetching secret access metrics:', error);
  }
  
  return {
    secrets: {
      used: secretCount,
      limit: FREE_TIER_LIMITS.secretManager.secrets,
      percentage: (secretCount / FREE_TIER_LIMITS.secretManager.secrets) * 100,
    },
    accesses: {
      used: totalAccesses,
      limit: FREE_TIER_LIMITS.secretManager.accessOperations,
      percentage: (totalAccesses / FREE_TIER_LIMITS.secretManager.accessOperations) * 100,
    },
  };
}

/**
 * Send alert notification
 */
async function sendAlert(message, usage) {
  console.error('ALERT:', message);
  console.log('Current usage:', JSON.stringify(usage, null, 2));
  
  // You can integrate with your notification service here
  // Example: Send to Slack, Discord, Email, etc.
  
  // For now, we'll just log to Cloud Logging
  // The logs will trigger alert policies if configured
}

/**
 * Main function - HTTP trigger
 */
exports.monitorUsage = async (req, res) => {
  console.log('Starting free tier usage check...');
  
  try {
    // Collect all usage metrics
    const [cloudRunUsage, storageUsage, vmUptime, secretUsage] = await Promise.all([
      getCloudRunUsage(),
      getStorageUsage(),
      getVMUptime(),
      getSecretManagerUsage(),
    ]);
    
    const usage = {
      timestamp: new Date().toISOString(),
      cloudRun: cloudRunUsage,
      storage: storageUsage,
      vm: vmUptime,
      secretManager: secretUsage,
    };
    
    // Check for alerts (80% threshold)
    const alerts = [];
    
    if (usage.cloudRun.requests.percentage > 80) {
      alerts.push(`Cloud Run requests at ${usage.cloudRun.requests.percentage.toFixed(1)}% of free tier`);
    }
    
    if (usage.cloudRun.cpu.percentage > 80) {
      alerts.push(`Cloud Run CPU at ${usage.cloudRun.cpu.percentage.toFixed(1)}% of free tier`);
    }
    
    if (usage.cloudRun.memory.percentage > 80) {
      alerts.push(`Cloud Run memory at ${usage.cloudRun.memory.percentage.toFixed(1)}% of free tier`);
    }
    
    if (usage.storage.percentage > 80) {
      alerts.push(`Cloud Storage at ${usage.storage.percentage.toFixed(1)}% of free tier`);
    }
    
    if (usage.vm.percentage > 80) {
      alerts.push(`VM uptime at ${usage.vm.percentage.toFixed(1)}% of free tier`);
    }
    
    if (usage.secretManager.secrets.percentage > 80) {
      alerts.push(`Secret Manager secrets at ${usage.secretManager.secrets.percentage.toFixed(1)}% of free tier`);
    }
    
    if (usage.secretManager.accesses.percentage > 80) {
      alerts.push(`Secret Manager accesses at ${usage.secretManager.accesses.percentage.toFixed(1)}% of free tier`);
    }
    
    // Send alerts if any
    if (alerts.length > 0) {
      await sendAlert(alerts.join('\n'), usage);
    }
    
    // Calculate overall health score
    const healthScore = 100 - Math.max(
      usage.cloudRun.requests.percentage,
      usage.cloudRun.cpu.percentage,
      usage.cloudRun.memory.percentage,
      usage.storage.percentage,
      usage.vm.percentage,
      usage.secretManager.secrets.percentage,
      usage.secretManager.accesses.percentage
    );
    
    usage.healthScore = healthScore;
    usage.status = healthScore > 20 ? 'healthy' : healthScore > 0 ? 'warning' : 'critical';
    usage.alerts = alerts;
    
    // Store usage data for historical tracking
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `usage-reports/${timestamp}.json`;
    const file = storage.bucket(BUCKET_NAME).file(fileName);
    await file.save(JSON.stringify(usage, null, 2), {
      metadata: {
        contentType: 'application/json',
      },
    });
    
    console.log('Usage check complete:', usage);
    
    res.status(200).json(usage);
  } catch (error) {
    console.error('Error monitoring usage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Scheduled function - Pub/Sub trigger
 */
exports.scheduledMonitor = async (message, context) => {
  console.log('Running scheduled usage check...');
  
  // Call the main monitoring function
  await exports.monitorUsage(
    { body: {} },
    {
      status: (code) => ({
        json: (data) => console.log('Result:', data),
      }),
    }
  );
};