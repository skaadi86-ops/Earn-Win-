# Earn & Win - Premium Earning Website

A modern, mobile-friendly earning website with Firebase integration, featuring a spinning wheel, wallet management, and referral system.

## Features

### 🔐 Authentication
- Email & password authentication using Firebase Auth
- User registration with name, email, password, and UPI ID
- Automatic user document creation in Firestore

### 🎯 Spin Screen
- Interactive spinning wheel with 6 different point rewards (10-200 points)
- Daily spin limit of 5 spins per user
- Automatic spin reset at midnight
- Simulated rewarded ads after each spin
- Real-time points tracking

### 💰 Wallet Screen
- Real-time balance display (1000 points = ₹1)
- Withdrawal functionality with minimum ₹100 requirement
- Transaction history tracking
- Automatic points deduction on withdrawal

### 👤 Profile Screen
- Editable user profile (name and UPI ID)
- Unique referral code generation and copying
- Referral code application system
- ₹10 bonus for both inviter and invitee

## Firebase Setup

### 1. Firebase Configuration
The app uses your provided Firebase configuration:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyAe3JHhrZ8Yl6STpMYeeeNg6nTZO1atgvg",
    authDomain: "earning-website-921d2.firebaseapp.com",
    projectId: "earning-website-921d2",
    storageBucket: "earning-website-921d2.firebasestorage.app",
    messagingSenderId: "1047082395308",
    appId: "1:1047082395308:web:41020670adc71e4f3b6109",
    measurementId: "G-SLKPYBPX60"
};
```

### 2. Firestore Collections

#### Users Collection
```javascript
{
    uid: "user_uid",
    name: "User Name",
    email: "user@email.com",
    upiId: "name@upi",
    points: 0,
    referralCode: "ABC123",
    appliedReferralCode: null,
    spinsToday: 0,
    lastSpinDate: "Mon Dec 18 2023",
    createdAt: timestamp,
    updatedAt: timestamp
}
```

#### WithdrawalRequests Collection
```javascript
{
    userId: "user_uid",
    userName: "User Name",
    userEmail: "user@email.com",
    upiId: "name@upi",
    amount: 100,
    status: "pending",
    createdAt: timestamp
}
```

### 3. Firebase Services Required
- **Authentication**: Email/Password
- **Firestore**: Database for user data and withdrawal requests
- **Analytics**: Optional for tracking

## File Structure

```
├── index.html          # Main HTML file with all screens
├── style.css           # Premium CSS styling with animations
├── app.js              # JavaScript with Firebase integration
└── README.md           # This file
```

## Getting Started

1. **Clone or download** the files to your local directory
2. **Open** `index.html` in a modern web browser
3. **Create an account** or sign in with existing credentials
4. **Start earning** by spinning the wheel daily!

## Features Breakdown

### Spin Wheel Algorithm
- 6 segments with different point values (10, 25, 50, 100, 150, 200)
- Smooth animation with easing function
- Random spin duration and rotation
- Automatic result calculation based on final position

### Points System
- **Conversion Rate**: 1000 points = ₹1
- **Daily Spins**: 5 spins per day, resets at midnight
- **Referral Bonus**: ₹10 (10,000 points) for both users
- **Withdrawal**: Minimum ₹100 required

### Security Features
- Firebase Auth for secure authentication
- Firestore rules for data protection
- Input validation and sanitization
- CSRF protection through Firebase

### Mobile Responsiveness
- Responsive design for all screen sizes
- Touch-friendly interface
- Optimized for mobile browsers
- Progressive Web App features

## Customization

### Colors and Styling
The app uses a modern gradient theme with:
- Primary gradient: `#667eea` to `#764ba2`
- Accent color: `#ffd700` (gold)
- Success color: `#00b894`
- Error color: `#ff6b6b`

### Spin Wheel Customization
Edit the `segments` array in `app.js` to modify:
- Point values
- Colors
- Number of segments

### Point Conversion
Modify the conversion rate in `app.js`:
```javascript
function pointsToRupees(points) {
    return (points / 1000).toFixed(2); // Change 1000 to your rate
}
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance Features

- Lazy loading of Firebase modules
- Optimized animations using requestAnimationFrame
- Efficient DOM manipulation
- Minimal reflows and repaints

## Future Enhancements

- Real ad integration (AdMob, etc.)
- Push notifications
- Social media sharing
- Leaderboards
- Achievement system
- Multiple payment methods
- Admin dashboard

## Support

For technical support or feature requests, please refer to the Firebase documentation or contact the development team.

---

**Note**: This is a demo application. For production use, ensure proper security rules, rate limiting, and additional validation are implemented.
