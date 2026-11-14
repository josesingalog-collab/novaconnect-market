import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/cart-context";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("savpay-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
