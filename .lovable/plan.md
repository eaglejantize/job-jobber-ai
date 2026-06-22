Add a "Sign in" link to the mobile menu in `src/components/landing/Navbar.tsx`, shown only when the user is signed out, placed directly above the "Start Free Trial" button. It will reuse the desktop styling (`text-sm font-medium text-ink hover:text-navy`) and link to `/auth`, closing the menu on click.

Only the mobile menu block is touched; desktop nav and signed-in behavior are unchanged.