// inventory-backend/src/utils/sendWhatsApp.js

/**
 * Sends a WhatsApp notification to a lab assistant via Meta Business Cloud API.
 * 
 * @param {Object} env - Cloudflare Worker environment bindings
 * @param {Object} details - Details of the issue to send
 * @param {string} details.assistantPhone - Recipient phone number (e.g. +91 98765 43210)
 * @param {string} details.assistantName - Recipient assistant's name
 * @param {string} details.labName - Name of the laboratory
 * @param {string} details.deviceName - Name/ID of the device
 * @param {string} details.deviceCode - QR code text of the device (e.g. SGI-Xyz12)
 * @param {string} details.studentClass - Student's class
 * @param {string} details.studentDiv - Student's division
 * @param {string} details.studentRollNo - Student's roll number
 * @param {string} details.description - Description of the reported issue
 * @returns {Promise<boolean>} Resolves to true if successfully sent, false otherwise.
 */
export async function sendWhatsAppNotification(env, details) {
    const {
        assistantPhone,
        assistantName,
        labName,
        deviceName,
        deviceCode,
        studentClass,
        studentDiv,
        studentRollNo,
        description
    } = details;

    if (!assistantPhone) {
        console.warn('sendWhatsAppNotification: No assistant phone number registered for this lab.');
        return false;
    }

    const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
    const token = env.WHATSAPP_ACCESS_TOKEN;
    const templateName = env.WHATSAPP_TEMPLATE_NAME;
    const langCode = env.WHATSAPP_TEMPLATE_LANG || "en"; // Fallback to 'en' if not specified

    if (!phoneId || !token || !templateName) {
        console.error('sendWhatsAppNotification: Meta WhatsApp credentials missing in env bindings (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, or WHATSAPP_TEMPLATE_NAME).');
        return false;
    }

    // Sanitize phone number (Meta requires digits only, e.g. 919876543210)
    const cleanPhone = assistantPhone.replace(/\D/g, '');
    if (!cleanPhone) {
        console.error(`sendWhatsAppNotification: Sanitized phone number for "${assistantPhone}" is empty.`);
        return false;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

    // Constructing the payload based on template name
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
            name: templateName,
            language: {
                code: langCode
            }
        }
    };

    // Only add custom body parameters if we are NOT using Meta's default 'hello_world' template
    if (templateName !== 'hello_world') {
        payload.template.components = [
            {
                type: "body",
                parameters: [
                    { type: "text", text: assistantName || "Lab Assistant" },
                    { type: "text", text: labName || "N/A" },
                    { type: "text", text: deviceName || "N/A" },
                    { type: "text", text: deviceCode || "N/A" },
                    { type: "text", text: studentClass || "N/A" },
                    { type: "text", text: studentDiv || "N/A" },
                    { type: "text", text: studentRollNo || "N/A" },
                    { type: "text", text: description || "N/A" }
                ]
            }
        ];
    }

    try {
        console.log(`Sending WhatsApp message to ${cleanPhone} using template "${templateName}" (${langCode})...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`WhatsApp API response status: ${response.status}. Body:`, responseText);

        if (response.ok) {
            return true;
        } else {
            console.error(`Failed to send WhatsApp message. Meta API returned: ${responseText}`);
            return false;
        }
    } catch (error) {
        console.error('Error occurred while calling Meta WhatsApp API:', error);
        return false;
    }
}
