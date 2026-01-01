# Quick Testing Checklist

## Setup (5 min)
- [ ] Backend running on port 5000
- [ ] Frontend running on port 8080
- [ ] Database connected
- [ ] Staff account logged in

## Configuration (2 min)
- [ ] Business Settings: Point Value = 10 PKR
- [ ] Business Settings: Redemption Threshold = 50 points

## Membership Tiers (5 min)
- [ ] Create Bronze tier (5% discount, 10 points/session)
- [ ] Create Silver tier (10% discount, 20 points/session)
- [ ] Create Gold tier (15% discount, 30 points/session)

## Client Setup (5 min)
- [ ] Create Client 1: John Doe (Bronze, RFID001)
- [ ] Create Client 2: Jane Smith (Silver, RFID002)
- [ ] Create Client 3: Bob Wilson (Gold, RFID003)

## RFID Testing (3 min)
- [ ] Scan RFID001 → John Doe selected
- [ ] Scan RFID002 → Jane Smith selected
- [ ] Invalid RFID → Error shown

## Points Awarding (5 min)
- [ ] Book appointment for John Doe
- [ ] Mark as Completed
- [ ] Verify: 10 points awarded, 1 session

## Points Redemption (5 min)
- [ ] Complete 5+ appointments for John Doe (50+ points)
- [ ] Book new appointment
- [ ] Redeem 50 points
- [ ] Verify: 500 PKR discount applied

## Session Reset (2 min)
- [ ] Go to Memberships page
- [ ] Reset sessions for John Doe
- [ ] Verify: Sessions = 0, Points unchanged

## Client Portal - Registration (3 min)
- [ ] Go to /client-portal/register
- [ ] Register with John Doe's phone
- [ ] Verify: Redirected to dashboard

## Client Portal - Features (10 min)
- [ ] Dashboard: View membership, points, sessions
- [ ] Points: View transaction history
- [ ] Appointments: View appointment history
- [ ] Billing: View payment history
- [ ] Profile: Change password

## Integration Test (10 min)
- [ ] Complete flow: Create client → Book → Complete → Earn points → Redeem → Portal access

## Total Time: ~55 minutes

---

## Quick API Endpoints Reference

### Admin/Staff Endpoints
- `GET /api/clients` - List all clients
- `GET /api/clients/:id` - Get client details
- `GET /api/clients/rfid/:rfidNumber` - Get client by RFID
- `POST /api/clients/:id/reset-sessions` - Reset client sessions
- `GET /api/clients/:id/points-history` - Get points history
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment

### Client Portal Endpoints
- `POST /api/client-portal/register` - Register client
- `POST /api/client-portal/login` - Login client
- `GET /api/client-portal/profile` - Get profile (protected)
- `GET /api/client-portal/points-history` - Get points history (protected)
- `GET /api/client-portal/appointments` - Get appointments (protected)
- `GET /api/client-portal/payments` - Get payments (protected)
- `PUT /api/client-portal/password` - Change password (protected)

---

## Test Data Examples

### Membership Tier Example
```json
{
  "name": "Gold",
  "discount_percent": 15,
  "points_per_session": 30,
  "point_value": 10,
  "redemption_threshold": 50
}
```

### Client Example
```json
{
  "name": "John Doe",
  "phone": "03001234567",
  "email": "john@example.com",
  "membership_id": "<tier_id>",
  "rfid_number": "RFID001"
}
```

### Appointment with Points Redemption
```json
{
  "clientId": "<client_id>",
  "serviceVariationId": "<service_id>",
  "staffId": "<staff_id>",
  "startTime": "2024-01-15T10:00:00Z",
  "pointsToRedeem": 50
}
```

---

## Common Test Scenarios

1. **New Member Journey**
   - Register → First appointment → Earn points → Redeem points

2. **Loyal Member Journey**
   - Multiple appointments → Accumulate points → Large redemption

3. **Session Reset Journey**
   - Complete sessions → Reset by admin → Continue earning

4. **Portal Access Journey**
   - Register → Login → View history → Change password

---

## Expected Results

### Points Calculation
- Bronze: 10 points per completed appointment
- Silver: 20 points per completed appointment
- Gold: 30 points per completed appointment

### Discount Calculation
- Bronze: 5% discount on services
- Silver: 10% discount on services
- Gold: 15% discount on services

### Points Redemption
- 1 point = 10 PKR (configurable)
- Minimum 50 points required for redemption
- Points discount = Points × Point Value

---

## Error Scenarios to Test

- [ ] Redeem points below threshold → Error
- [ ] Redeem more points than available → Error
- [ ] Register without membership → Error
- [ ] Login with wrong password → Error
- [ ] Access protected route without login → Redirect

---

## Performance Checks

- [ ] RFID lookup < 500ms
- [ ] Points history loads < 1s
- [ ] Appointment creation < 2s
- [ ] Client portal pages load < 1s

---

**Note**: For detailed step-by-step instructions, see `TESTING_GUIDE.md`
