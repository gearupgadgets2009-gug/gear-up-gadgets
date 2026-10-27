/**
 * ============================================================================
 * Gear Up Gadgets - Client-Side Transactional Email Service
 * ============================================================================
 * 
 * Securely triggers server-side email dispatches via /api/send-email.
 * Zero credentials are stored in frontend client code.
 */

(function() {
    'use strict';

    window.GUG_EMAIL = {
        apiEndpoint: '/api/send-email',

        /**
         * Low-level dispatcher to /api/send-email
         */
        async sendMail({ to, subject, html, text, type, orderDetails, customerInfo, dealerInfo }) {
            try {
                if (!to) {
                    console.warn('[GUG Email Service]: Recipient email is missing.');
                    return { success: false, error: 'Recipient email required' };
                }

                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        to,
                        subject,
                        html,
                        text,
                        type,
                        orderDetails,
                        customerInfo,
                        dealerInfo
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    console.log(`[GUG Email Service]: Email sent successfully to ${to}. MessageId: ${result.messageId}`);
                    if (window.GUG_DB && typeof window.GUG_DB.showToast === 'function') {
                        window.GUG_DB.showToast(`Notification email sent to ${to}`, 'success', 'Email Gateway');
                    }
                    return result;
                } else {
                    console.warn('[GUG Email Service]: Server returned email error:', result.error);
                    return { success: false, error: result.error || 'Server error' };
                }
            } catch (err) {
                console.warn('[GUG Email Service]: Network error while reaching email gateway:', err.message);
                // Return gracefully so UI workflows are never blocked if offline
                return { success: false, error: err.message };
            }
        },

        /**
         * Dispatches automated order confirmation email to customer & store admin
         */
        async sendOrderConfirmationEmail(order) {
            if (!order) return;
            const customerEmail = (order.customer && order.customer.email) || order.email;
            if (!customerEmail) {
                console.log('[GUG Email Service]: Order has no customer email attached.');
                return;
            }

            const subject = `Order Confirmation #${order.id} - Gear Up Gadgets`;
            const text = `Dear ${(order.customer && order.customer.name) || order.name || 'Valued Customer'},\n\nThank you for your order with Gear Up Gadgets! Your order #${order.id} has been received and is being processed.\n\nTotal Amount: Rs. ${Number(order.total || 0).toLocaleString()}\nPayment Method: ${order.paymentMethod || 'Cash on Delivery'}\n\nWe will update you once your package is dispatched!`;

            return this.sendMail({
                to: customerEmail,
                subject,
                text,
                type: 'order_confirmation',
                orderDetails: order
            });
        },

        /**
         * Dispatches B2B Dealer payment receipt email
         */
        async sendDealerPaymentReceipt(dealer, paymentDetails) {
            if (!dealer || !dealer.email) return;

            const subject = `B2B Payment Receipt - Gear Up Gadgets [Dealer: ${dealer.shopName || dealer.name}]`;
            const text = `Dear ${dealer.ownerName || dealer.name},\n\nWe have recorded your recent payment of Rs. ${Number(paymentDetails.amount || 0).toLocaleString()}.\nPayment Mode: ${paymentDetails.method || 'Cash'}\nReference Code: ${paymentDetails.refCode || 'N/A'}\nRemaining Balance: Rs. ${Number(paymentDetails.balance || 0).toLocaleString()}\n\nThank you for your valued partnership.`;

            return this.sendMail({
                to: dealer.email,
                subject,
                text,
                type: 'b2b_payment',
                dealerInfo: {
                    id: dealer.id,
                    name: dealer.name,
                    shopName: dealer.shopName,
                    balance: paymentDetails.balance
                }
            });
        },

        /**
         * Dispatches Customer CRM account dossier summary
         */
        async sendCustomerDossier(customer, ordersSummary) {
            if (!customer || !customer.email) return;

            const subject = `Customer Statement & Purchase Dossier - Gear Up Gadgets`;
            const text = `Dear ${customer.name},\n\nPlease find your account statement from Gear Up Gadgets.\nCustomer ID: ${customer.id}\nTotal Orders: ${ordersSummary.totalOrders || 1}\nLifetime Spend: Rs. ${Number(ordersSummary.totalSpent || 0).toLocaleString()}`;

            return this.sendMail({
                to: customer.email,
                subject,
                text,
                type: 'crm_statement',
                customerInfo: customer
            });
        }
    };

    console.log("📧 [GUG Email Service] Gateway initialized via /api/send-email (process.env secured).");
})();
