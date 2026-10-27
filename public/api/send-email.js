/**
 * ============================================================================
 * Gear Up Gadgets - Enterprise Email Dispatcher Serverless Function
 * Compatible with Vercel Serverless, Netlify Functions, and Node.js Runtimes
 * ============================================================================
 * 
 * Securely dispatches transactional emails via Gmail SMTP using process.env
 * without exposing sensitive credentials to client-side code.
 */

const nodemailer = require('nodemailer');

// Load .env locally if not running in production serverless container
try {
    require('dotenv').config();
} catch (e) {
    // dotenv is optional in production serverless environments where env vars are injected
}

module.exports = async function handler(req, res) {
    // Enable CORS for frontend API calls
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed. Only POST requests are supported.'
        });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;

    if (!gmailUser || !gmailPass) {
        console.error('[Email Dispatcher Error]: Missing GMAIL_USER or GMAIL_PASS environment variables.');
        return res.status(500).json({
            success: false,
            error: 'Server email credentials are not configured in environment variables (GMAIL_USER / GMAIL_PASS).'
        });
    }

    try {
        const { to, subject, html, text, type, orderDetails, customerInfo, dealerInfo } = req.body || {};

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Recipient email address ("to") is required.'
            });
        }

        const mailSubject = subject || 'Gear Up Gadgets Notification';

        // Build HTML content: use custom HTML if provided, or generate a branded template
        let emailHtml = html;
        if (!emailHtml) {
            emailHtml = generateBrandedEmailHtml({
                type: type || 'general',
                subject: mailSubject,
                text: text || '',
                orderDetails,
                customerInfo,
                dealerInfo
            });
        }

        // Initialize Nodemailer SMTP Transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });

        const mailOptions = {
            from: `"Gear Up Gadgets Enterprise" <${gmailUser}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: mailSubject,
            text: text || 'Please view this email in an HTML-compatible email client.',
            html: emailHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Dispatcher Success]: Sent "${mailSubject}" to ${to}. MessageId: ${info.messageId}`);

        return res.status(200).json({
            success: true,
            message: 'Email dispatched successfully.',
            messageId: info.messageId
        });
    } catch (error) {
        console.error('[Email Dispatcher Exception]:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An error occurred while sending the email.'
        });
    }
};

/**
 * Generate a responsive, dark-mode-optimized branded email template
 */
function generateBrandedEmailHtml({ type, subject, text, orderDetails, customerInfo, dealerInfo }) {
    let bodyContent = `<p style="font-size: 14px; line-height: 1.6; color: #333333;">${text || 'Thank you for choosing Gear Up Gadgets.'}</p>`;

    if (orderDetails) {
        bodyContent += `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0f172a; font-size: 16px; border-bottom: 2px solid #E50303; padding-bottom: 8px;">Order Details: #${orderDetails.id || 'N/A'}</h3>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Order Date:</strong> ${orderDetails.date || new Date().toLocaleDateString()}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Total Amount:</strong> <span style="color: #E50303; font-weight: bold;">Rs. ${Number(orderDetails.total || 0).toLocaleString()}</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Payment Method:</strong> ${orderDetails.paymentMethod || 'Cash on Delivery'}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> ${orderDetails.orderStatus || 'Processing'}</p>
            </div>
        `;
    }

    if (dealerInfo) {
        bodyContent += `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #0f172a; font-size: 16px; border-bottom: 2px solid #E50303; padding-bottom: 8px;">B2B Wholesale Account: ${dealerInfo.shopName || dealerInfo.name || 'Valued Dealer'}</h3>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Dealer ID:</strong> ${dealerInfo.id || 'N/A'}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Outstanding Balance:</strong> <span style="color: #E50303; font-weight: bold;">Rs. ${Number(dealerInfo.balance || 0).toLocaleString()}</span></p>
            </div>
        `;
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 30px 15px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 600px; width: 100%;">
                            <!-- Header -->
                            <tr>
                                <td style="background-color: #07090d; padding: 25px 30px; text-align: center; border-bottom: 3px solid #E50303;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">
                                        GEAR <span style="color: #E50303;">UP</span> GADGETS
                                    </h1>
                                    <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                        Enterprise Computer Systems &bull; Karachi, Pakistan
                                    </p>
                                </td>
                            </tr>
                            <!-- Content Body -->
                            <tr>
                                <td style="padding: 35px 30px;">
                                    <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">${subject}</h2>
                                    ${bodyContent}
                                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                                    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
                                        If you have any questions, reach out to our official support team at <a href="mailto:gearupgadgets2009@gmail.com" style="color: #E50303; text-decoration: none;">gearupgadgets2009@gmail.com</a> or call <strong>021 34832214</strong> / WhatsApp <strong>0300 1234567</strong>.
                                    </p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                                    Shop F6, Technocity Mall, Hasrat Mohani Road, Karachi, Pakistan<br>
                                    &copy; ${new Date().getFullYear()} Gear Up Gadgets. All rights reserved.
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}
