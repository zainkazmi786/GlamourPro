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

    // Update business information
    if (businessName !== undefined) settings.businessName = businessName;
    if (contactPhone !== undefined) settings.contactPhone = contactPhone;
    if (email !== undefined) settings.email = email;
    if (website !== undefined) settings.website = website;
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

