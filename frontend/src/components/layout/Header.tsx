"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  TOOL_CATEGORIES,
  type ToolCategoryInfo,
} from "@/components/home/tools";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopMenu({
  cat,
  open,
  onOpen,
  onClose,
  active,
  pathname,
}: {
  cat: ToolCategoryInfo;
  open: boolean;
  onOpen: () => void;
  onClose: (restoreFocus?: boolean) => void;
  active: boolean;
  pathname: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openedByHover = useRef(false);
  const panelId = `menu-${cat.id}`;
  const wide = cat.tools.length > 8;

  const links = () =>
    Array.from(
      wrapRef.current?.querySelectorAll<HTMLAnchorElement>(
        "[data-menu-link]",
      ) ?? [],
    );

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onOpen();
      requestAnimationFrame(() => links()[0]?.focus());
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = links();
    const i = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i <= 0) buttonRef.current?.focus();
      else items[i - 1]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        // Hover-open only for real mouse pointers; touch uses click.
        if (!open && window.matchMedia("(hover: hover)").matches) {
          openedByHover.current = true;
          onOpen();
        }
      }}
      onMouseLeave={() => {
        openedByHover.current = false;
        onClose(false);
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null))
          onClose(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          onClose(true);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // A click right after hover-opening keeps the menu open instead of flicking it shut.
          if (openedByHover.current) openedByHover.current = false;
          else if (open) onClose(false);
          else onOpen();
        }}
        onKeyDown={onButtonKey}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground",
          focusRing,
          active || open ? "text-foreground" : "text-muted-foreground",
          active && "bg-accent/60",
        )}
      >
        <cat.icon className={cn("h-4 w-4", cat.textColor)} aria-hidden="true" />
        <span>{cat.navLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 opacity-60 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {/* pt-1 bridges the gap so the pointer can travel from button to panel */}
      <div
        id={panelId}
        hidden={!open}
        onKeyDown={onPanelKey}
        className="absolute left-0 top-full z-50 pt-1"
      >
        <div
          className={cn(
            "rounded-lg border bg-background p-1.5 shadow-lg",
            wide ? "grid w-[28rem] grid-cols-2 gap-x-1" : "min-w-[14rem]",
          )}
        >
          {cat.tools.map((tool) => {
            const current = isActiveHref(pathname, tool.href);
            return (
              <Link
                key={tool.href}
                href={tool.href}
                data-menu-link
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  focusRing,
                  current && "bg-accent font-medium text-primary",
                )}
              >
                {tool.title}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(
    null,
  );
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close everything whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Close desktop dropdown on outside click / touch.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: Event) => {
      if (!(e.target as HTMLElement).closest("[data-desktop-nav]"))
        setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openMenu]);

  // Lock page scroll while the mobile menu is open; Escape closes it.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    // If the viewport grows past the mobile breakpoint, drop the menu.
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [mobileOpen]);

  const close = useCallback(() => setMobileOpen(false), []);
  const blogActive = isActiveHref(pathname, "/blog");

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav
          aria-label="Main"
          className="container mx-auto flex h-14 items-center justify-between px-4 sm:h-16"
        >
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 rounded-md text-lg font-bold sm:text-xl",
              focusRing,
            )}
            title="PDFGlide - Free Online PDF Tools"
            aria-label="PDFGlide home"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-base font-bold text-white shadow-sm"
            >
              P
            </span>
            <span className="bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
              PDFGlide
            </span>
          </Link>

          {/* Desktop navigation */}
          <div data-desktop-nav className="hidden items-center gap-1 md:flex">
            {TOOL_CATEGORIES.map((cat) => (
              <DesktopMenu
                key={cat.id}
                cat={cat}
                pathname={pathname}
                open={openMenu === cat.id}
                active={cat.tools.some((t) => isActiveHref(pathname, t.href))}
                onOpen={() => setOpenMenu(cat.id)}
                onClose={() =>
                  setOpenMenu((cur) => (cur === cat.id ? null : cur))
                }
              />
            ))}
            <Link
              href="/blog"
              aria-current={blogActive ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground",
                focusRing,
                blogActive
                  ? "bg-accent/60 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              Blog
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-accent md:hidden",
              focusRing,
            )}
          >
            {mobileOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </nav>
      </header>

      {/* Mobile menu (outside <header>: backdrop-filter would trap a fixed child): fills the viewport under the header and scrolls on its own */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-14 sm:top-16 z-40 overflow-y-auto overscroll-contain border-t bg-background md:hidden"
        >
          <div className="container mx-auto px-4 py-2 pb-10">
            {TOOL_CATEGORIES.map((cat) => {
              const expanded = openMobileSection === cat.id;
              const active = cat.tools.some((t) =>
                isActiveHref(pathname, t.href),
              );
              return (
                <div key={cat.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMobileSection(expanded ? null : cat.id)
                    }
                    aria-expanded={expanded}
                    aria-controls={`mobile-${cat.id}`}
                    className={cn(
                      "flex min-h-[48px] w-full items-center justify-between rounded-md text-left text-base font-medium",
                      focusRing,
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <cat.icon
                        className={cn("h-5 w-5", cat.textColor)}
                        aria-hidden="true"
                      />
                      {cat.label}
                      {active && (
                        <span
                          className="h-2 w-2 rounded-full bg-primary"
                          aria-label="current section"
                        />
                      )}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded && (
                    <ul id={`mobile-${cat.id}`} className="pb-2 pl-8">
                      {cat.tools.map((tool) => {
                        const current = isActiveHref(pathname, tool.href);
                        return (
                          <li key={tool.href}>
                            <Link
                              href={tool.href}
                              onClick={close}
                              aria-current={current ? "page" : undefined}
                              className={cn(
                                "flex min-h-[44px] items-center rounded-md px-3 text-[15px] transition-colors hover:bg-accent active:bg-accent",
                                focusRing,
                                current
                                  ? "bg-accent font-medium text-primary"
                                  : "text-foreground/80",
                              )}
                            >
                              {tool.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            <Link
              href="/blog"
              onClick={close}
              aria-current={blogActive ? "page" : undefined}
              className={cn(
                "flex min-h-[48px] items-center rounded-md text-base font-medium",
                focusRing,
                blogActive && "text-primary",
              )}
            >
              Blog
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
