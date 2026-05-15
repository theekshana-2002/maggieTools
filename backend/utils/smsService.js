const axios = require('axios');

/**
 * SMS Service Utility
 * Integrated with SMSlenz.lk
 */

const sendSMS = async (to, message) => {
  try {
    if (!to) {
      console.warn('[SMS SERVICE] Missing phone number. Skipping.');
      return { success: false, error: 'Missing phone number' };
    }

    // SMSlenz usually requires international format (e.g., +947XXXXXXXX)
    let cleanPhone = to.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '94' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('94')) {
      cleanPhone = '94' + cleanPhone;
    }
    
    const formattedPhone = '+' + cleanPhone;

    const userId = process.env.SMS_USER_ID;
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || 'SMSlenzDEMO';

    if (!userId || !apiKey) {
      console.error('[SMS SERVICE] Credentials missing in .env');
      return { success: false, error: 'SMS credentials missing' };
    }

    const response = await axios.get('https://www.smslenz.lk/api/send-sms', {
      params: {
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        contact: formattedPhone,
        message: message
      }
    });

    console.log(`DEBUG: SMSlenz Request Params:`, { userId, senderId, contact: formattedPhone });

    if (response.data && (response.data.success === true || response.data.status === 'success')) {
      console.log(`✅ SMS Sent Successfully to ${formattedPhone} via SMSlenz`);
      return { success: true, data: response.data };
    } else {
      console.error('❌ SMS Failed (SMSlenz):', response.data);
      return { success: false, error: response.data };
    }

  } catch (err) {
    console.error('❌ SMS Service Error (SMSlenz):', err.response ? err.response.data : err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendSMS };
