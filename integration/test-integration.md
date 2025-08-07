# Integration Testing Checklist

## Prerequisites
- [ ] API server running on port 8080
- [ ] Frontend running on port 3000
- [ ] Database connected and migrated
- [ ] Environment variables configured

## Authentication Tests
- [ ] **Registration**
  - Navigate to `/signup`
  - Fill in name, email, password
  - Submit form
  - Verify redirect to dashboard
  - Check localStorage for tokens

- [ ] **Login**
  - Navigate to `/login`
  - Enter credentials
  - Submit form
  - Verify redirect to dashboard
  - Check user data loaded

- [ ] **Logout**
  - Click logout button
  - Verify redirect to login
  - Check tokens cleared from localStorage

- [ ] **Protected Routes**
  - Try accessing `/dashboard` without login
  - Verify redirect to `/login`

## Dashboard Tests
- [ ] **Email List**
  - Verify emails load from API
  - Check pagination works
  - Test search functionality
  - Verify real-time updates (new email notification)

- [ ] **Email Operations**
  - Click email to view details
  - Mark as read/unread
  - Test delete functionality
  - Verify optimistic updates

## AI Response Tests
- [ ] **Generate Response**
  - Select an email
  - Click "Generate Response"
  - Verify loading state
  - Check response appears
  - Test different styles

- [ ] **Response Actions**
  - Copy response to clipboard
  - Edit response
  - Save changes
  - Regenerate response

## Settings Tests
- [ ] **Profile Update**
  - Change name
  - Save changes
  - Verify toast notification
  - Reload page to confirm persistence

- [ ] **Preferences**
  - Toggle notifications
  - Change AI model
  - Update response style
  - Verify settings saved

## Error Handling Tests
- [ ] **Network Errors**
  - Stop API server
  - Try to load emails
  - Verify error message appears
  - Check retry functionality

- [ ] **Invalid Token**
  - Manually corrupt token in localStorage
  - Refresh page
  - Verify redirect to login

## Performance Tests
- [ ] **Loading States**
  - Check skeleton loaders appear
  - Verify smooth transitions
  - Test with slow network (DevTools)

- [ ] **Optimistic Updates**
  - Mark email as read
  - Verify immediate UI update
  - Check rollback on error

## Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile responsive

## Console Checks
- [ ] No errors in console
- [ ] No warning about keys
- [ ] No failed network requests
- [ ] No memory leaks

## Final Verification
- [ ] All mock data removed
- [ ] API endpoints working
- [ ] Real-time updates functional
- [ ] Error boundaries catching errors
- [ ] Toast notifications appearing

## Sign-off
- Date tested: ___________
- Tested by: ___________
- Issues found: ___________
- Status: [ ] PASS [ ] FAIL