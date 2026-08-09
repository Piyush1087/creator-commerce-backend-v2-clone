import { useState, type PropsWithChildren } from "react";

/**
 * Staging adapter for the canonical application-shell Content Area contract.
 * Global navigation and shell chrome are intentionally platform-owned and absent here.
 */
export function ApplicationShell({ children }: PropsWithChildren) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="applicationShell">
      <aside className="desktopSidebar" aria-label="Global navigation">
        <strong className="shellBrand">CS</strong>
        <nav><a href="#home">Home</a><a href="#brands">Brand Centre</a><a className="active" href="#campaigns">Campaigns</a><a href="#collabs">Collaborations</a></nav>
        <nav className="sidebarFooter"><a href="#payouts">Payouts</a><a href="#settings">Settings</a></nav>
      </aside>
      <div className="shellMain">
        <header className="globalHeader">
          <strong className="mobileBrand">CS</strong>
          <div className="globalActions"><button className="upgradeButton" type="button">Upgrade</button><button aria-label="Notifications" className="iconButton" type="button">◌</button><button aria-label="Open global navigation" className="menuButton" onClick={() => setDrawerOpen(true)} type="button">☰</button></div>
        </header>
        <main className="contentArea" aria-label="Creator Shop application content">{children}</main>
      </div>
      {drawerOpen && <div className="mobileDrawerLayer"><button aria-label="Close navigation" className="drawerBackdrop" onClick={() => setDrawerOpen(false)} type="button" /><aside className="mobileDrawer" aria-label="Global navigation"><div className="drawerTop"><strong>The Creator Shop</strong><button aria-label="Close navigation" className="iconButton" onClick={() => setDrawerOpen(false)} type="button">×</button></div><nav><a href="#home">Home</a><a href="#brands">Brand Centre</a><a className="active" href="#campaigns">Campaigns</a><a href="#collabs">Collaborations</a></nav></aside></div>}
      <nav className="mobileBottomNav" aria-label="Global navigation"><a href="#home">Home</a><a href="#brands">Brands</a><a className="active" href="#campaigns">Campaigns</a><a href="#collabs">Collabs</a></nav>
    </div>
  );
}
