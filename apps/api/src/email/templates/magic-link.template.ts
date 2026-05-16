import type { EmailPalette } from '../email-palette.js';

export const text = (url: string) =>
  `Log in to Linklater by clicking this link:\n\n${url}\n\nThis link expires in 15 minutes. If you didn't request this, you can safely ignore this email.`;

export const html = (url: string, palette: EmailPalette) => `
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
                <h1 style="margin: 0 0 16px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 28px; line-height: 34px; color: ${palette.text}; font-weight: 700;">Your login link.</h1>
                <p style="margin: 0 0 28px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 26px; color: ${palette.text};">Click the button below to log in. This link expires in 15 minutes.</p>

                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="${palette.accent}" style="border-radius: 8px; padding: 14px 32px;">
                      <a href="${url}" style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; display: inline-block;">Log in to Linklater</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 24px 0 0; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: ${palette.textSubtle}; word-break: break-all;">${url}</p>
              </td>
            </tr>

            <tr>
              <td bgcolor="${palette.bgElevated}" style="padding: 20px 40px; border-top: 1px solid ${palette.border};">
                <p style="margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 18px; color: ${palette.textSubtle};">If you did not request this login link, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
