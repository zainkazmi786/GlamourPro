const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const Appointment = require('../models/Appointment');
const Attendance = require('../models/Attendance');

// Helper function to get start and end of day
const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Helper function to get start and end of month
const getStartOfMonth = (date) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
};

// @desc    Get today's revenue
// @route   GET /api/dashboard/today-revenue
// @access  Private
const getTodayRevenue = async (req, res) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStart = getStartOfDay(today);
    const todayEnd = getEndOfDay(today);
    const yesterdayStart = getStartOfDay(yesterday);
    const yesterdayEnd = getEndOfDay(yesterday);

    // Get today's revenue
    const todayPayments = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: {
            $gte: todayStart,
            $lte: todayEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payable_amount' }
        }
      }
    ]);

    // Get yesterday's revenue
    const yesterdayPayments = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: {
            $gte: yesterdayStart,
            $lte: yesterdayEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payable_amount' }
        }
      }
    ]);

    const todayRevenue = todayPayments.length > 0 ? todayPayments[0].total : 0;
    const yesterdayRevenue = yesterdayPayments.length > 0 ? yesterdayPayments[0].total : 0;

    // Calculate increase rate
    let increaseRate = 0;
    if (yesterdayRevenue > 0) {
      increaseRate = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
    } else if (todayRevenue > 0) {
      increaseRate = 100; // 100% increase if yesterday was 0
    }

    res.status(200).json({
      success: true,
      data: {
        revenue: Math.round(todayRevenue * 100) / 100,
        increaseRate: Math.round(increaseRate * 100) / 100
      }
    });
  } catch (error) {
    console.error('getTodayRevenue - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s revenue',
      error: error.message
    });
  }
};

// @desc    Get active clients count
// @route   GET /api/dashboard/active-clients
// @access  Private
const getActiveClients = async (req, res) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStart = getStartOfDay(today);
    const todayEnd = getEndOfDay(today);
    const yesterdayStart = getStartOfDay(yesterday);
    const yesterdayEnd = getEndOfDay(yesterday);

    // Count clients with appointments or payments in last 30 days (active clients)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAppointmentClientIds = await Appointment.distinct('clientId', {
      startTime: { $gte: thirtyDaysAgo }
    });
    
    const recentPaymentAppointmentIds = await Payment.distinct('appointment_id', {
      createdAt: { $gte: thirtyDaysAgo }
    });
    const recentPaymentClientIds = await Appointment.distinct('clientId', {
      _id: { $in: recentPaymentAppointmentIds }
    });
    
    const activeClientIds = [...new Set([...recentAppointmentClientIds.map(id => id.toString()), ...recentPaymentClientIds.map(id => id.toString())])];
    const activeClientsCount = activeClientIds.length;

    // For increase rate, compare today vs yesterday active clients
    const todayAppointmentClientIds = await Appointment.distinct('clientId', {
      startTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    const todayPaymentAppointmentIds = await Payment.distinct('appointment_id', {
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    const todayPaymentClientIds = await Appointment.distinct('clientId', {
      _id: { $in: todayPaymentAppointmentIds }
    });
    
    const yesterdayAppointmentClientIds = await Appointment.distinct('clientId', {
      startTime: { $gte: yesterdayStart, $lte: yesterdayEnd }
    });
    
    const yesterdayPaymentAppointmentIds = await Payment.distinct('appointment_id', {
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
    });
    const yesterdayPaymentClientIds = await Appointment.distinct('clientId', {
      _id: { $in: yesterdayPaymentAppointmentIds }
    });

    const todayActiveIds = [...new Set([...todayAppointmentClientIds.map(id => id.toString()), ...todayPaymentClientIds.map(id => id.toString())])];
    const yesterdayActiveIds = [...new Set([...yesterdayAppointmentClientIds.map(id => id.toString()), ...yesterdayPaymentClientIds.map(id => id.toString())])];

    const todayCount = todayActiveIds.length;
    const yesterdayCount = yesterdayActiveIds.length;

    let increaseRate = 0;
    if (yesterdayCount > 0) {
      increaseRate = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
    } else if (todayCount > 0) {
      increaseRate = 100;
    }

    res.status(200).json({
      success: true,
      data: {
        count: activeClientsCount,
        increaseRate: Math.round(increaseRate * 100) / 100
      }
    });
  } catch (error) {
    console.error('getActiveClients - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active clients',
      error: error.message
    });
  }
};

// @desc    Get today's appointments
// @route   GET /api/dashboard/today-appointments
// @access  Private
const getTodayAppointments = async (req, res) => {
  try {
    const today = new Date();
    const todayStart = getStartOfDay(today);
    const todayEnd = getEndOfDay(today);

    // Get total appointments for today
    const totalAppointments = await Appointment.countDocuments({
      startTime: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });

    // Get pending appointments (scheduled or confirmed)
    const pendingAppointments = await Appointment.countDocuments({
      startTime: {
        $gte: todayStart,
        $lte: todayEnd
      },
      status: {
        $in: ['scheduled', 'confirmed']
      }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalAppointments,
        pending: pendingAppointments
      }
    });
  } catch (error) {
    console.error('getTodayAppointments - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s appointments',
      error: error.message
    });
  }
};

// @desc    Get monthly revenue
// @route   GET /api/dashboard/monthly-revenue
// @access  Private
const getMonthlyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const monthStart = getStartOfMonth(today);
    const monthEnd = getEndOfMonth(today);

    const monthlyPayments = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: {
            $gte: monthStart,
            $lte: monthEnd
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payable_amount' }
        }
      }
    ]);

    const monthlyRevenue = monthlyPayments.length > 0 ? monthlyPayments[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        revenue: Math.round(monthlyRevenue * 100) / 100
      }
    });
  } catch (error) {
    console.error('getMonthlyRevenue - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly revenue',
      error: error.message
    });
  }
};

// @desc    Get staff on duty
// @route   GET /api/dashboard/staff-on-duty
// @access  Private
const getStaffOnDuty = async (req, res) => {
  try {
    const today = new Date();
    const todayStart = getStartOfDay(today);
    const todayEnd = getEndOfDay(today);

    // Count staff who have attendance records for today with isPresent = true
    const staffOnDuty = await Attendance.distinct('staffId', {
      date: {
        $gte: todayStart,
        $lte: todayEnd
      },
      $or: [
        { isPresent: true },
        { status: 'present' }
      ]
    });

    const count = staffOnDuty.length;

    res.status(200).json({
      success: true,
      data: {
        count: count
      }
    });
  } catch (error) {
    console.error('getStaffOnDuty - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff on duty',
      error: error.message
    });
  }
};

// @desc    Get weekly revenue (last 7 days)
// @route   GET /api/dashboard/weekly-revenue
// @access  Private
const getWeeklyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today, so 6 days back

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = [];

    // Get revenue for each of the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayStart = getStartOfDay(date);
      const dayEnd = getEndOfDay(date);

      const dayPayments = await Payment.aggregate([
        {
          $match: {
            status: 'paid',
            createdAt: {
              $gte: dayStart,
              $lte: dayEnd
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$payable_amount' }
          }
        }
      ]);

      const revenue = dayPayments.length > 0 ? dayPayments[0].total : 0;
      const dayName = days[date.getDay()];

      weeklyData.push({
        name: dayName,
        revenue: Math.round(revenue * 100) / 100
      });
    }

    res.status(200).json({
      success: true,
      data: weeklyData
    });
  } catch (error) {
    console.error('getWeeklyRevenue - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching weekly revenue',
      error: error.message
    });
  }
};

// @desc    Get popular services
// @route   GET /api/dashboard/popular-services
// @access  Private
const getPopularServices = async (req, res) => {
  try {
    const BaseService = require('../models/BaseService');
    
    // Get service distribution from appointments in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // First, check if there are any appointments
    const appointmentCount = await Appointment.countDocuments({
      startTime: { $gte: thirtyDaysAgo }
    });

    console.log('getPopularServices - Appointment count (last 30 days):', appointmentCount);

    let serviceData = [];

    if (appointmentCount === 0) {
      // If no appointments in last 30 days, check all-time appointments
      const allTimeAppointmentCount = await Appointment.countDocuments({});
      
      if (allTimeAppointmentCount === 0) {
        // No appointments at all, return all active services with equal distribution for display
        const allServices = await BaseService.find({ isActive: true })
          .select('name')
          .limit(10)
          .lean();

        console.log('getPopularServices - No appointments found, returning all active services:', allServices.length);

        const colors = [
          'hsl(var(--chart-1))',
          'hsl(var(--chart-2))',
          'hsl(var(--chart-3))',
          'hsl(var(--chart-4))',
          'hsl(var(--chart-5))',
          'hsl(var(--chart-6))',
          'hsl(var(--chart-7))',
          'hsl(var(--chart-8))',
          'hsl(var(--chart-9))',
          'hsl(var(--chart-10))'
        ];

        // Distribute equally among services for display (each gets 100/n %)
        const equalPercentage = allServices.length > 0 ? Math.round(100 / allServices.length) : 0;

        serviceData = allServices.map((service, index) => ({
          name: service.name,
          value: equalPercentage,
          color: colors[index % colors.length],
          count: 0,
          revenue: 0
        }));
      } else {
        // Use all-time appointments instead
        const serviceStats = await Appointment.aggregate([
          {
            $group: {
              _id: '$baseServiceId',
              count: { $sum: 1 },
              totalRevenue: { $sum: '$totalPrice' }
            }
          },
          {
            $lookup: {
              from: 'baseservices',
              localField: '_id',
              foreignField: '_id',
              as: 'service'
            }
          },
          {
            $unwind: {
              path: '$service',
              preserveNullAndEmptyArrays: false
            }
          },
          {
            $match: {
              'service.isActive': true
            }
          },
          {
            $project: {
              name: '$service.name',
              count: 1,
              totalRevenue: 1
            }
          },
          {
            $sort: { count: -1 }
          },
          {
            $limit: 10
          }
        ]);

        const totalAppointments = serviceStats.reduce((sum, service) => sum + service.count, 0);
        const colors = [
          'hsl(var(--chart-1))',
          'hsl(var(--chart-2))',
          'hsl(var(--chart-3))',
          'hsl(var(--chart-4))',
          'hsl(var(--chart-5))',
          'hsl(var(--chart-6))',
          'hsl(var(--chart-7))',
          'hsl(var(--chart-8))',
          'hsl(var(--chart-9))',
          'hsl(var(--chart-10))'
        ];

        serviceData = serviceStats.map((service, index) => ({
          name: service.name,
          value: totalAppointments > 0 ? Math.round((service.count / totalAppointments) * 100) : 0,
          color: colors[index % colors.length],
          count: service.count,
          revenue: service.totalRevenue
        }));
      }
    } else {
      // Get service stats from appointments
      const serviceStats = await Appointment.aggregate([
        {
          $match: {
            startTime: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$baseServiceId',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalPrice' }
          }
        },
        {
          $lookup: {
            from: 'baseservices',
            localField: '_id',
            foreignField: '_id',
            as: 'service'
          }
        },
        {
          $unwind: {
            path: '$service',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $match: {
            'service.isActive': true
          }
        },
        {
          $project: {
            name: '$service.name',
            count: 1,
            totalRevenue: 1
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10 // Top 10 services
        }
      ]);

      console.log('getPopularServices - Service stats from appointments:', serviceStats.length, serviceStats);

      // Calculate total appointments for percentage
      const totalAppointments = serviceStats.reduce((sum, service) => sum + service.count, 0);
      
      console.log('getPopularServices - Total appointments:', totalAppointments);

      // Map to chart format with colors
      const colors = [
        'hsl(var(--chart-1))',
        'hsl(var(--chart-2))',
        'hsl(var(--chart-3))',
        'hsl(var(--chart-4))',
        'hsl(var(--chart-5))',
        'hsl(var(--chart-6))',
        'hsl(var(--chart-7))',
        'hsl(var(--chart-8))',
        'hsl(var(--chart-9))',
        'hsl(var(--chart-10))'
      ];

      serviceData = serviceStats.map((service, index) => ({
        name: service.name,
        value: totalAppointments > 0 ? Math.round((service.count / totalAppointments) * 100) : 0,
        color: colors[index % colors.length],
        count: service.count,
        revenue: service.totalRevenue
      }));
    }

    console.log('getPopularServices - Final service data:', serviceData.length, serviceData);

    res.status(200).json({
      success: true,
      data: serviceData
    });
  } catch (error) {
    console.error('getPopularServices - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching popular services',
      error: error.message
    });
  }
};

// @desc    Get today's appointments list
// @route   GET /api/dashboard/today-appointments-list
// @access  Private
const getTodayAppointmentsList = async (req, res) => {
  try {
    const today = new Date();
    const todayStart = getStartOfDay(today);
    const todayEnd = getEndOfDay(today);

    const appointments = await Appointment.find({
      startTime: {
        $gte: todayStart,
        $lte: todayEnd
      }
    })
      .populate('clientId', 'name')
      .populate('baseServiceId', 'name')
      .populate('serviceVariationId', 'variationName')
      .populate('staffId', 'name')
      .sort({ startTime: 1 })
      .lean();

    const appointmentsList = appointments.map(apt => ({
      _id: apt._id.toString(),
      client: apt.clientId?.name || 'Unknown',
      service: apt.serviceVariationId?.variationName || apt.baseServiceId?.name || 'Unknown',
      time: apt.startTime ? new Date(apt.startTime).toISOString() : new Date().toISOString(),
      therapist: apt.staffId?.name || 'Unknown',
      status: apt.status
    }));

    res.status(200).json({
      success: true,
      data: appointmentsList
    });
  } catch (error) {
    console.error('getTodayAppointmentsList - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s appointments list',
      error: error.message
    });
  }
};

module.exports = {
  getTodayRevenue,
  getActiveClients,
  getTodayAppointments,
  getMonthlyRevenue,
  getStaffOnDuty,
  getWeeklyRevenue,
  getPopularServices,
  getTodayAppointmentsList
};




