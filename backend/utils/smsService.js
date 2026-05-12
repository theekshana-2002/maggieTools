const axios = require('axios');

/**
 * SMS Service Utility
 * Currently set as a Mock service. 
 * To use a real provider (e.g., Notify.lk or Twilio), replace the logic below.
 */

const sendSMS = async (to, message) => {
  try {
    if (!to) {
      console.warn('[SMS SERVICE] Missing phone number. Skipping.');
      return { success: false, error: 'Missing phone number' };
    }
    const cleanPhone = to.replace(/[^0-9]/g, '');
    
    console.log(`--------------------------------------------------`);
    console.log(`📲 AUTOMATED SMS LOG`);
    console.log(`TO: ${cleanPhone}`);
    console.log(`MESSAGE: ${message}`);
    console.log(`STATUS: Test Mode (Logging only)`);
    console.log(`--------------------------------------------------`);

    /**
     * EXAMPLE INTEGRATION (Notify.lk):
     * 
     * await axios.get('https://app.notify.lk/api/v1/send', {
     *   params: {
     *     user_id: 'YOUR_USER_ID',
     *     api_key: 'YOUR_API_KEY',
     *     sender_id: 'NotifyDemo',
     *     to: cleanPhone,
     *     message: message
     *   }
     * });
     */

    return { success: true, message: 'SMS Sent (Mock)' };
  } catch (err) {
    console.error('SMS Service Error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendSMS };
