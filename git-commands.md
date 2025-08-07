# Standard Git Commands

## First Commit & Repo Creation

```bash
# 1. Create .gitignore first (for JavaScript/Node projects)
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.DS_Store
*.log
dist/
build/
.next/
EOF

# 2. Initialize and commit
git init
git add .
git commit -m "Initial commit"

# 3. Create GitHub repo and push
gh repo create PROJECT_NAME --public --source=. --remote=origin
git push -u origin main
```

## Subsequent Commits

```bash
# Standard commit and push
git add .
git commit -m "Your commit message"
git push

# Or with specific files
git add path/to/file
git commit -m "Update: specific change description"
git push
```

## Quick Aliases (add to ~/.bashrc or ~/.zshrc)

```bash
# First commit function
alias gfirst='echo "node_modules/" > .gitignore && git init && git add . && git commit -m "Initial commit"'

# Quick commit and push
alias gcp='git add . && git commit -m "$1" && git push'
```