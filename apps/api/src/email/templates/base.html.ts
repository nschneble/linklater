interface BaseHtmlOptions {
  heading: string;
  bodyText: string;
  buttonLabel: string;
  buttonUrl: string;
  footerNote: string;
}

export const baseHtml = ({
  heading,
  bodyText,
  buttonLabel,
  buttonUrl,
  footerNote,
}: BaseHtmlOptions): string => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Linklater</title>
  </head>

  <body style="margin: 0; padding: 0; background: #f5f5f0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f0">
      <tr>
        <td align="center" style="padding: 40px 20px;">
          <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-radius: 8px; overflow: hidden; border:1px solid #e8e8e8;">
            <tr>
              <td style="padding: 28px 40px; border-bottom: 1px solid #e8e8e8;">
                <span style="font-family: Georgia, serif; font-size: 22px; font-weight: bold; color: #c03812; letter-spacing: -0.5px;">Linklater</span>
              </td>
            </tr>

            <tr>
              <td style="padding: 44px 40px 36px;">
                <h1 style="margin: 0 0 16px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 28px; line-height: 34px; color:#1a1a1a; font-weight: 700;">${heading}</h1>
                <p style="margin: 0 0 28px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 26px; color: #444444;">${bodyText}</p>

                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="#c03812" style="border-radius: 6px; padding: 13px 32px;">
                      <a href="${buttonUrl}" style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">${buttonLabel}</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 24px 0 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 20px; color: #888888;">
                  Or copy and paste this link into your browser:<br />
                  <a href="${buttonUrl}" style="color: #c03812; word-break: break-all;">${buttonUrl}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td bgcolor="#fafafa" style="padding: 20px 40px; border-top: 1px solid #e8e8e8;">
                <p style="margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 18px; color: #999999;">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
