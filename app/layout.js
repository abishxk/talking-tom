import "./globals.css";
import { Baloo_2, Nunito } from "next/font/google";

// Display: chunky rounded — headline + primary button.
const displayFont = Baloo_2({
  subsets: ["latin"],
  variable: "--font-display",
});

// Body: rounded, friendly — labels, inputs, helper text.
const bodyFont = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: "Talking Tom",
  description: "Interactive singing experience",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
