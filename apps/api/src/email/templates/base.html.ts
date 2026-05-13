import type { EmailPalette } from '../email-palette.js';

interface BaseHtmlOptions {
  heading: string;
  bodyText: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
  palette: EmailPalette;
}

export const baseHtml = ({
  heading,
  bodyText,
  buttonLabel,
  buttonUrl,
  footerNote,
  palette,
}: BaseHtmlOptions): string => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Linklater</title>
  </head>

  <body style="margin: 0; padding: 0; background: ${palette.bg};">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.bg}">
      <tr>
        <td align="center" style="padding: 40px 20px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.bgSurface}" style="border-radius: 8px; overflow: hidden; border:1px solid ${palette.border};">
            <tr>
              <td style="padding: 28px 40px; border-bottom: 1px solid ${palette.border};">
                <span style="font-family: Georgia, serif; font-size: 22px; font-weight: bold; color: ${palette.accent}; letter-spacing: -0.5px;">Linklater</span>
              </td>
            </tr>

            <tr>
              <td style="padding: 44px 40px 36px;">
                <h1 style="margin: 0 0 16px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 28px; line-height: 34px; color: ${palette.text}; font-weight: 700;">${heading}</h1>
                <p style="margin: 0 0 28px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 26px; color: ${palette.text};">${bodyText}</p>

                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="${palette.accent}" style="border-radius: 6px; padding: 13px 32px;">
                      <a href="${buttonUrl}" style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; font-weight: 600; color: ${palette.accentFg}; text-decoration: none;">${buttonLabel}</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 24px 0 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 20px; color: ${palette.textMuted};">
                  Or copy and paste this link into your browser:<br />
                  <a href="${buttonUrl}" style="color: ${palette.accent}; word-break: break-all;">${buttonUrl}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td bgcolor="${palette.bgElevated}" style="padding: 20px 40px; border-top: 1px solid ${palette.border};">
                <p style="margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 18px; color: ${palette.textSubtle};">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
