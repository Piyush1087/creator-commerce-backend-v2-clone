# Content Area Contract

The Application Shell owns:
- Desktop Sidebar
- Desktop Header
- Mobile Header
- Mobile Bottom Navigation
- Mobile Navigation Drawer
- Global notifications
- User menu

Feature modules own:
- Page content
- Drawers
- Modals
- Workspace interactions

Feature modules must never:
- Recreate navigation
- Replace shell headers
- Modify shell spacing
- Override shell layout
- Introduce independent navigation systems

Every feature screen begins inside the Content Area.
