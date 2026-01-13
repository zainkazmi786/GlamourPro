const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const MonthlySalary = require('../models/MonthlySalary');

// Helper functions for date calculations
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

// Helper functions for time period calculations
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday is 0
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + 6; // Saturday
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getStartOfQuarter = (date) => {
  const d = new Date(date);
  const quarter = Math.floor(d.getMonth() / 3);
  d.setMonth(quarter * 3);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfQuarter = (date) => {
  const d = new Date(date);
  const quarter = Math.floor(d.getMonth() / 3);
  d.setMonth(quarter * 3 + 3);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getStartOfYear = (date) => {
  const d = new Date(date);
  d.setMonth(0);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfYear = (date) => {
  const d = new Date(date);
  d.setMonth(11);
  d.setDate(31);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Get date range based on period
const getDateRange = (period) => {
  const today = new Date();
  let startDate, endDate;

  switch (period) {
    case 'week':
      startDate = getStartOfWeek(today);
      endDate = getEndOfWeek(today);
      break;
    case 'month':
      startDate = getStartOfMonth(today);
      endDate = getEndOfMonth(today);
      break;
    case 'quarter':
      startDate = getStartOfQuarter(today);
      endDate = getEndOfQuarter(today);
      break;
    case 'year':
      startDate = getStartOfYear(today);
      endDate = getEndOfYear(today);
      break;
    default:
      // Default to month
      startDate = getStartOfMonth(today);
      endDate = getEndOfMonth(today);
  }

  return { startDate, endDate };
};

// @desc    Get revenue vs expenses
// @route   GET /api/reports/revenue-expenses?period=week|month|quarter|year
// @access  Private (Manager only)
const getRevenueExpenses = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = [];
    let periodsToShow = 6;

    // Determine how many periods to show based on selected period
    if (period === 'week') {
      periodsToShow = 6; // Last 6 weeks
    } else if (period === 'month') {
      periodsToShow = 6; // Last 6 months
    } else if (period === 'quarter') {
      periodsToShow = 4; // Last 4 quarters
    } else if (period === 'year') {
      periodsToShow = 5; // Last 5 years
    }

    // Get data for the specified number of periods
    for (let i = periodsToShow - 1; i >= 0; i--) {
      let date, periodStart, periodEnd, periodLabel;

      if (period === 'week') {
        date = new Date(today);
        date.setDate(date.getDate() - (i * 7));
        periodStart = getStartOfWeek(date);
        periodEnd = getEndOfWeek(date);
        periodLabel = `Week ${i + 1}`;
      } else if (period === 'month') {
        date = new Date(today);
        date.setMonth(date.getMonth() - i);
        periodStart = getStartOfMonth(date);
        periodEnd = getEndOfMonth(date);
        periodLabel = monthNames[date.getMonth()];
      } else if (period === 'quarter') {
        date = new Date(today);
        date.setMonth(date.getMonth() - (i * 3));
        periodStart = getStartOfQuarter(date);
        periodEnd = getEndOfQuarter(date);
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodLabel = `Q${quarter} ${date.getFullYear()}`;
      } else if (period === 'year') {
        date = new Date(today);
        date.setFullYear(date.getFullYear() - i);
        periodStart = getStartOfYear(date);
        periodEnd = getEndOfYear(date);
        periodLabel = date.getFullYear().toString();
      }

      // Get revenue for this month
      const revenueData = await Payment.aggregate([
        {
          $match: {
            status: 'paid',
            createdAt: {
              $gte: periodStart,
              $lte: periodEnd
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

      const revenue = revenueData.length > 0 ? revenueData[0].total : 0;

      // Get expenses (salaries) for this period
      let expenses = 0;
      if (period === 'month') {
        const expensesData = await MonthlySalary.aggregate([
          {
            $match: {
              month: date.getMonth() + 1,
              year: date.getFullYear(),
              status: 'paid'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$netSalary' }
            }
          }
        ]);
        expenses = expensesData.length > 0 ? expensesData[0].total : 0;
      } else {
        // For other periods, sum all salaries in the date range
        const expensesData = await MonthlySalary.aggregate([
          {
            $match: {
              createdAt: {
                $gte: periodStart,
                $lte: periodEnd
              },
              status: 'paid'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$netSalary' }
            }
          }
        ]);
        expenses = expensesData.length > 0 ? expensesData[0].total : 0;
      }

      months.push({
        month: periodLabel,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100
      });
    }

    res.status(200).json({
      success: true,
      data: months
    });
  } catch (error) {
    console.error('getRevenueExpenses - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue and expenses',
      error: error.message
    });
  }
};

// @desc    Get popular services statistics
// @route   GET /api/reports/popular-services?period=week|month|quarter|year
// @access  Private (Manager only)
const getPopularServices = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate } = getDateRange(period);
    const BaseService = require('../models/BaseService');

    // Get service stats from appointments
    const serviceStats = await Appointment.aggregate([
      {
        $match: {
          startTime: { 
            $gte: startDate,
            $lte: endDate
          }
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
        $limit: 10
      }
    ]);

    const totalAppointments = serviceStats.reduce((sum, service) => sum + service.count, 0);

    const servicesData = serviceStats.map((service) => ({
      name: service.name,
      value: totalAppointments > 0 ? Math.round((service.count / totalAppointments) * 100) : 0,
      count: service.count
    }));

    res.status(200).json({
      success: true,
      data: servicesData
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

// @desc    Get staff performance (clients served and revenue)
// @route   GET /api/reports/staff-performance?period=week|month|quarter|year
// @access  Private (Manager only)
const getStaffPerformance = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate } = getDateRange(period);

    const Staff = require('../models/Staff');

    // First, get all active staff members excluding receptionist and manager roles
    const allStaff = await Staff.find({
      status: 'Active',
      role: { $nin: ['receptionist', 'manager'] }
    }).select('_id name role');

    console.log(`getStaffPerformance - Found ${allStaff.length} active staff (excluding receptionist and manager)`);

    // Get staff performance from appointments
    // Try both 'staff' and 'staffs' collection names (MongoDB may use either)
    let appointmentStats = [];
    const collectionNames = ['staff', 'staffs'];
    
    for (const collectionName of collectionNames) {
      try {
        appointmentStats = await Appointment.aggregate([
          {
            $match: {
              startTime: { 
                $gte: startDate,
                $lte: endDate
              },
              status: 'completed',
              staffId: { $ne: null } // Ensure staffId exists
            }
          },
          {
            $group: {
              _id: '$staffId',
              clients: { $addToSet: '$clientId' },
              revenue: { $sum: '$totalPrice' }
            }
          }
        ]);
        
        if (appointmentStats.length > 0) {
          console.log(`getStaffPerformance - Successfully found ${appointmentStats.length} staff with appointments using collection "${collectionName}"`);
          break; // Success, stop trying other collection names
        }
      } catch (error) {
        console.log(`getStaffPerformance - Collection "${collectionName}" failed:`, error.message);
        continue; // Try next collection name
      }
    }

    // Create a map of staffId -> performance data
    const performanceMap = new Map();
    appointmentStats.forEach(stat => {
      performanceMap.set(stat._id.toString(), {
        clients: stat.clients.length,
        revenue: Math.round(stat.revenue * 100) / 100
      });
    });

    // Combine all staff with their performance data (or 0 if no appointments)
    const performanceData = allStaff.map(staff => {
      const staffId = staff._id.toString();
      const perf = performanceMap.get(staffId) || { clients: 0, revenue: 0 };
      
      return {
        name: staff.name || 'Unknown Staff',
        clients: perf.clients,
        revenue: perf.revenue
      };
    });

    // Sort by revenue descending
    performanceData.sort((a, b) => b.revenue - a.revenue);

    console.log('getStaffPerformance - Final result count:', performanceData.length);
    if (performanceData.length > 0) {
      console.log('getStaffPerformance - All results:', JSON.stringify(performanceData, null, 2));
    }

    res.status(200).json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('getStaffPerformance - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff performance',
      error: error.message
    });
  }
};

// @desc    Get summary KPIs (Total Revenue, Expenses, Net Profit, Active Members)
// @route   GET /api/reports/summary?period=week|month|quarter|year
// @access  Private (Manager only)
const getSummary = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate } = getDateRange(period);
    
    // Calculate previous period for comparison
    let previousStartDate, previousEndDate;
    const today = new Date();
    
    if (period === 'week') {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      previousStartDate = getStartOfWeek(lastWeek);
      previousEndDate = getEndOfWeek(lastWeek);
    } else if (period === 'month') {
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      previousStartDate = getStartOfMonth(lastMonth);
      previousEndDate = getEndOfMonth(lastMonth);
    } else if (period === 'quarter') {
      const lastQuarter = new Date(today);
      lastQuarter.setMonth(lastQuarter.getMonth() - 3);
      previousStartDate = getStartOfQuarter(lastQuarter);
      previousEndDate = getEndOfQuarter(lastQuarter);
    } else if (period === 'year') {
      const lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      previousStartDate = getStartOfYear(lastYear);
      previousEndDate = getEndOfYear(lastYear);
    }

    // Get current period revenue
    const currentPeriodRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: {
            $gte: startDate,
            $lte: endDate
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

    // Get previous period revenue
    const previousPeriodRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: {
            $gte: previousStartDate,
            $lte: previousEndDate
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

    const totalRevenue = currentPeriodRevenue.length > 0 ? currentPeriodRevenue[0].total : 0;
    const previousPeriodRev = previousPeriodRevenue.length > 0 ? previousPeriodRevenue[0].total : 0;
    const revenueIncrease = previousPeriodRev > 0 ? ((totalRevenue - previousPeriodRev) / previousPeriodRev) * 100 : (totalRevenue > 0 ? 100 : 0);

    // Get current period expenses (salaries)
    const currentPeriodExpenses = await MonthlySalary.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netSalary' }
        }
      }
    ]);

    const totalExpenses = currentPeriodExpenses.length > 0 ? currentPeriodExpenses[0].total : 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Get active members (clients with membership in the period)
    const activeMembers = await Client.countDocuments({
      membership_id: { $ne: null },
      $or: [
        { createdAt: { $gte: startDate, $lte: endDate } },
        { updatedAt: { $gte: startDate, $lte: endDate } }
      ]
    });

    // Get new members in this period
    const newMembersThisPeriod = await Client.countDocuments({
      membership_id: { $ne: null },
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueIncrease: Math.round(revenueIncrease * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        activeMembers: activeMembers,
        newMembersThisMonth: newMembersThisPeriod
      }
    });
  } catch (error) {
    console.error('getSummary - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching summary',
      error: error.message
    });
  }
};

// Helper function to get revenue expenses data
const getRevenueExpensesData = async (period) => {
  const today = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = [];
  let periodsToShow = 6;

  if (period === 'week') periodsToShow = 6;
  else if (period === 'month') periodsToShow = 6;
  else if (period === 'quarter') periodsToShow = 4;
  else if (period === 'year') periodsToShow = 5;

  for (let i = periodsToShow - 1; i >= 0; i--) {
    let date, periodStart, periodEnd, periodLabel;

    if (period === 'week') {
      date = new Date(today);
      date.setDate(date.getDate() - (i * 7));
      periodStart = getStartOfWeek(date);
      periodEnd = getEndOfWeek(date);
      periodLabel = `Week ${i + 1}`;
    } else if (period === 'month') {
      date = new Date(today);
      date.setMonth(date.getMonth() - i);
      periodStart = getStartOfMonth(date);
      periodEnd = getEndOfMonth(date);
      periodLabel = monthNames[date.getMonth()];
    } else if (period === 'quarter') {
      date = new Date(today);
      date.setMonth(date.getMonth() - (i * 3));
      periodStart = getStartOfQuarter(date);
      periodEnd = getEndOfQuarter(date);
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      periodLabel = `Q${quarter} ${date.getFullYear()}`;
    } else if (period === 'year') {
      date = new Date(today);
      date.setFullYear(date.getFullYear() - i);
      periodStart = getStartOfYear(date);
      periodEnd = getEndOfYear(date);
      periodLabel = date.getFullYear().toString();
    }

    const revenueData = await Payment.aggregate([
      {
        $match: {
          status: 'paid',
          createdAt: { $gte: periodStart, $lte: periodEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payable_amount' }
        }
      }
    ]);

    const revenue = revenueData.length > 0 ? revenueData[0].total : 0;

    const expensesData = await MonthlySalary.aggregate([
      {
        $match: {
          createdAt: { $gte: periodStart, $lte: periodEnd },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netSalary' }
        }
      }
    ]);

    const expenses = expensesData.length > 0 ? expensesData[0].total : 0;

    months.push({
      month: periodLabel,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(expenses * 100) / 100
    });
  }

  return months;
};

// Helper function to get summary data
const getSummaryData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  let previousStartDate, previousEndDate;
  const today = new Date();
  
  if (period === 'week') {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    previousStartDate = getStartOfWeek(lastWeek);
    previousEndDate = getEndOfWeek(lastWeek);
  } else if (period === 'month') {
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    previousStartDate = getStartOfMonth(lastMonth);
    previousEndDate = getEndOfMonth(lastMonth);
  } else if (period === 'quarter') {
    const lastQuarter = new Date(today);
    lastQuarter.setMonth(lastQuarter.getMonth() - 3);
    previousStartDate = getStartOfQuarter(lastQuarter);
    previousEndDate = getEndOfQuarter(lastQuarter);
  } else if (period === 'year') {
    const lastYear = new Date(today);
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    previousStartDate = getStartOfYear(lastYear);
    previousEndDate = getEndOfYear(lastYear);
  }

  const currentPeriodRevenue = await Payment.aggregate([
    {
      $match: {
        status: 'paid',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$payable_amount' }
      }
    }
  ]);

  const previousPeriodRevenue = await Payment.aggregate([
    {
      $match: {
        status: 'paid',
        createdAt: { $gte: previousStartDate, $lte: previousEndDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$payable_amount' }
      }
    }
  ]);

  const totalRevenue = currentPeriodRevenue.length > 0 ? currentPeriodRevenue[0].total : 0;
  const previousPeriodRev = previousPeriodRevenue.length > 0 ? previousPeriodRevenue[0].total : 0;
  const revenueIncrease = previousPeriodRev > 0 ? ((totalRevenue - previousPeriodRev) / previousPeriodRev) * 100 : (totalRevenue > 0 ? 100 : 0);

  const currentPeriodExpenses = await MonthlySalary.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'paid'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$netSalary' }
      }
    }
  ]);

  const totalExpenses = currentPeriodExpenses.length > 0 ? currentPeriodExpenses[0].total : 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const activeMembers = await Client.countDocuments({
    membership_id: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { updatedAt: { $gte: startDate, $lte: endDate } }
    ]
  });

  const newMembersThisPeriod = await Client.countDocuments({
    membership_id: { $ne: null },
    createdAt: { $gte: startDate, $lte: endDate }
  });

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    revenueIncrease: Math.round(revenueIncrease * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    activeMembers: activeMembers,
    newMembersThisMonth: newMembersThisPeriod
  };
};

// @desc    Export reports as CSV
// @route   GET /api/reports/export?period=week|month|quarter|year
// @access  Private (Manager only)
const exportReports = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const { startDate, endDate } = getDateRange(period);

    // Fetch all report data
    const BaseService = require('../models/BaseService');
    
    // Get revenue vs expenses
    const revenueExpensesData = await getRevenueExpensesData(period);
    
    // Get popular services
    const popularServicesData = await Appointment.aggregate([
      {
        $match: {
          startTime: { $gte: startDate }
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
      }
    ]);

    // Get staff performance
    const staffPerformanceData = await Appointment.aggregate([
      {
        $match: {
          startTime: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$staffId',
          clients: { $addToSet: '$clientId' },
          revenue: { $sum: '$totalPrice' }
        }
      },
      {
        $lookup: {
          from: 'staff',
          localField: '_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      {
        $unwind: {
          path: '$staff',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $project: {
          name: '$staff.name',
          clients: { $size: '$clients' },
          revenue: 1
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);

    // Get summary
    const summaryData = await getSummaryData(period);

    // Generate CSV content
    let csvContent = 'Business Reports Export\n';
    csvContent += `Period: ${period.toUpperCase()}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Revenue vs Expenses
    csvContent += 'REVENUE VS EXPENSES\n';
    csvContent += 'Period,Revenue,Expenses,Net Profit\n';
    revenueExpensesData.forEach(item => {
      const netProfit = item.revenue - item.expenses;
      csvContent += `${item.month},${item.revenue},${item.expenses},${netProfit}\n`;
    });
    csvContent += '\n';

    // Popular Services
    csvContent += 'POPULAR SERVICES\n';
    csvContent += 'Service Name,Appointments,Revenue,Percentage\n';
    const totalAppointments = popularServicesData.reduce((sum, s) => sum + s.count, 0);
    popularServicesData.forEach(service => {
      const percentage = totalAppointments > 0 ? ((service.count / totalAppointments) * 100).toFixed(2) : 0;
      csvContent += `${service.name},${service.count},${service.totalRevenue},${percentage}%\n`;
    });
    csvContent += '\n';

    // Staff Performance
    csvContent += 'STAFF PERFORMANCE\n';
    csvContent += 'Staff Name,Clients Served,Revenue Generated\n';
    staffPerformanceData.forEach(staff => {
      csvContent += `${staff.name},${staff.clients},${staff.revenue}\n`;
    });
    csvContent += '\n';

    // Summary
    csvContent += 'SUMMARY\n';
    csvContent += `Total Revenue,${summaryData.totalRevenue}\n`;
    csvContent += `Total Expenses,${summaryData.totalExpenses}\n`;
    csvContent += `Net Profit,${summaryData.netProfit}\n`;
    csvContent += `Profit Margin,${summaryData.profitMargin.toFixed(2)}%\n`;
    csvContent += `Active Members,${summaryData.activeMembers}\n`;
    csvContent += `New Members,${summaryData.newMembersThisMonth}\n`;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reports-${period}-${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('exportReports - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting reports',
      error: error.message
    });
  }
};


module.exports = {
  getRevenueExpenses,
  getPopularServices,
  getStaffPerformance,
  getSummary,
  exportReports
};


