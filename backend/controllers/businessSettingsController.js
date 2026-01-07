const BusinessSettings = require('../models/BusinessSettings');

// @desc    Get business settings
// @route   GET /api/business-settings
// @access  Private
const getBusinessSettings = async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('getBusinessSettings - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching business settings',
      error: error.message
    });
  }
};

// @desc    Update business settings
// @route   PUT /api/business-settings
// @access  Private
const updateBusinessSettings = async (req, res) => {
  try {
    const {
      businessName,
      contactPhone,
      email,
      website,
      address,
      currency,
      pointValue,
      redemptionThreshold,
      taxRate,
      paymentMethods,
      openTime,
      closeTime,
      workingDays,
      annualLeaves
    } = req.body;

    // Get or create settings
    let settings = await BusinessSettings.findOne();
    
    if (!settings) {
      settings = new BusinessSettings({});
    }

    // Validation functions
    const validateEmail = (email) => {
      if (!email) return true; // Allow empty
      // Only alphanumeric, @, ., -, _ allowed
      const emailRegex = /^[a-zA-Z0-9@._-]+$/;
      return emailRegex.test(email);
    };

    const validateWebsite = (website) => {
      if (!website) return true; // Allow empty
      // Only alphanumeric, dots, hyphens allowed
      const websiteRegex = /^[a-zA-Z0-9.-]+$/;
      return websiteRegex.test(website);
    };

    const validatePakistaniPhone = (phone) => {
      if (!phone) return true; // Allow empty
      // Pakistani phone formats: +92 300 1234567, 0300 1234567, 300-1234567, 03001234567, +923001234567
      const phoneRegex = /^(\+92|0)?[\s-]?[0-9]{3}[\s-]?[0-9]{7}$/;
      return phoneRegex.test(phone.replace(/\s+/g, '').replace(/-/g, ''));
    };

    // Update business information with validation
    if (businessName !== undefined) settings.businessName = businessName;
    
    if (contactPhone !== undefined) {
      if (!validatePakistaniPhone(contactPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Please use Pakistani phone number format (e.g., +92 300 1234567 or 0300 1234567)'
        });
      }
      settings.contactPhone = contactPhone;
    }
    
    if (email !== undefined) {
      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email contains invalid characters. Only alphanumeric characters, @, ., -, and _ are allowed.'
        });
      }
      settings.email = email;
    }
    
    if (website !== undefined) {
      if (!validateWebsite(website)) {
        return res.status(400).json({
          success: false,
          message: 'Website name contains invalid characters. Only alphanumeric characters, dots, and hyphens are allowed.'
        });
      }
      settings.website = website;
    }
    
    if (address !== undefined) settings.address = address;

    // Update financial settings
    if (currency !== undefined) settings.currency = currency;
    if (pointValue !== undefined) settings.pointValue = pointValue;
    if (redemptionThreshold !== undefined) settings.redemptionThreshold = redemptionThreshold;
    if (taxRate !== undefined) settings.taxRate = taxRate;
    if (paymentMethods !== undefined) {
      if (paymentMethods.cash !== undefined) settings.paymentMethods.cash = paymentMethods.cash;
      if (paymentMethods.card !== undefined) settings.paymentMethods.card = paymentMethods.card;
      if (paymentMethods.bankTransfer !== undefined) settings.paymentMethods.bankTransfer = paymentMethods.bankTransfer;
      if (paymentMethods.eWallet !== undefined) settings.paymentMethods.eWallet = paymentMethods.eWallet;
    }

    // Update attendance settings
    if (openTime !== undefined) settings.openTime = openTime;
    if (closeTime !== undefined) settings.closeTime = closeTime;
    if (workingDays !== undefined) settings.workingDays = workingDays;
    if (annualLeaves !== undefined) settings.annualLeaves = annualLeaves;

    await settings.save();

    res.status(200).json({
      success: true,
      data: settings,
      message: 'Business settings updated successfully'
    });
  } catch (error) {
    console.error('updateBusinessSettings - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating business settings',
      error: error.message
    });
  }
};

module.exports = {
  getBusinessSettings,
  updateBusinessSettings
};






