# Novax Mini App - Developer Guide

## 🚀 Overview

The Novax Mini App is a modern React-based web application for tracking cryptocurrency and Iranian market prices with real-time alerts and AI-powered analysis.

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion (motion/react)
- **Icons**: Lucide React
- **State Management**: React Hooks
- **Backend Integration**: FastAPI (Python)
- **AI**: Google Gemini API

## 📦 Installation

```bash
cd mini-app
npm install
```

## 🔧 Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Run tests
npm test

# Watch tests
npm run test:watch

# Clean build artifacts
npm run clean
```

## 🏗️ Project Structure

```
mini-app/
├── src/
│   ├── components/          # React components
│   │   ├── PriceBoard.tsx
│   │   ├── AlertManager.tsx
│   │   ├── TelegramSimulator.tsx
│   │   ├── AIChat.tsx
│   │   └── SkeletonLoader.tsx
│   ├── hooks/              # Custom React hooks
│   │   └── useAnalytics.ts
│   ├── types.ts            # TypeScript types
│   ├── utils.ts            # Utility functions
│   ├── main.tsx            # Application entry point
│   ├── App.tsx             # Main app component
│   └── index.css           # Global styles
├── public/                 # Static assets
│   ├── manifest.json       # PWA manifest
│   └── robots.txt          # SEO robots file
├── server.ts               # Express server (development)
├── monitoring.config.js    # Monitoring configuration
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Jest testing configuration
├── jest.setup.js           # Jest setup file
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose configuration
└── package.json            # Dependencies and scripts
```

## 🎨 Component Architecture

### Core Components

1. **App.tsx**: Main application container
   - Manages global state (language, alerts, assets)
   - Handles API integration
   - Provides toast notifications
   - Manages loading and error states

2. **PriceBoard.tsx**: Price display and charts
   - Shows live prices with sparkline charts
   - Asset filtering (crypto, fiat, gold)
   - Price simulation with slider
   - Alert creation triggers

3. **AlertManager.tsx**: Alert management
   - Create/delete/toggle alerts
   - Alert logs display
   - Form validation
   - Loading states for operations

4. **AIChat.tsx**: AI-powered assistant
   - Gemini AI integration
   - Price analysis and insights
   - Natural language interface

5. **TelegramSimulator.tsx**: Telegram notification preview
   - Simulates Telegram message format
   - Tests alert notifications

## 🎯 Key Features

### Currency Conversion
- Automatic IRT (Rial) to Toman conversion
- USDT prices in USD
- Proper formatting for Persian numerals

### Real-time Updates
- 4-second polling interval
- WebSocket support for future implementation
- Automatic reconnection on connection loss

### Accessibility
- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA labels and roles

### Performance
- Code splitting for optimal loading
- Vendor chunk caching
- Lazy loading for components
- Image optimization
- CSS minification

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Testing Philosophy
- Unit tests for utility functions
- Component tests for React components
- Integration tests for API interactions
- E2E tests for critical user flows

## 📊 Monitoring

### Built-in Monitoring
- Performance metrics collection
- User engagement tracking
- Feature usage analytics
- Error tracking integration

### Analytics Integration
The app supports multiple analytics platforms:
- Google Analytics 4 (GA4)
- Plausible Analytics
- Custom analytics hook (`useAnalytics`)

### Performance Monitoring
Key metrics tracked:
- Page load time
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)

## 🚢 Deployment

### CI/CD Pipeline
Automated deployment via GitHub Actions:
- Linting and type checking
- Security scanning
- Testing
- VPS deployment with SSH
- Telegram notifications

### Manual Deployment
```bash
# Build
npm run build

# Deploy to VPS
rsync -avz dist/ user@vps:/path/to/app/
ssh user@vps "pm2 restart novax-mini-app"
```

### Docker Deployment
```bash
# Build Docker image
docker build -t novax-mini-app .

# Run with Docker Compose
docker-compose up -d

# Run standalone
docker run -p 3000:3000 novax-mini-app
```

## 🔐 Security

- Environment variable protection
- API key management
- CORS configuration
- Input validation and sanitization
- XSS prevention
- CSRF protection

## 🌍 Internationalization

- Persian (Farsi) as primary language
- English as secondary language
- RTL support for Persian
- Number formatting per locale
- Date/time formatting per locale

## 🎨 Design System

### Colors
- Primary: Teal (#14b8a6)
- Secondary: Indigo (#6366f1)
- Background: Slate (#060814)
- Text: White and Zinc variants

### Typography
- Persian font support
- Font sizes optimized for readability
- Monospace fonts for numbers and prices

### Spacing
- 4px base unit
- Consistent spacing scale
- Responsive breakpoints

## 🐛 Troubleshooting

### Common Issues

1. **Build fails with TypeScript errors**
   ```bash
   npm run type-check
   # Fix reported errors
   npm run lint:fix
   ```

2. **Port already in use**
   ```bash
   # Change port in .env
   PORT=3002 npm run dev
   ```

3. **API connection issues**
   - Check backend is running
   - Verify CORS configuration
   - Check environment variables

4. **Performance issues**
   - Check network tab in dev tools
   - Verify bundle size
   - Check for memory leaks

## 📝 Code Style

- ESLint for linting
- Prettier for formatting
- TypeScript for type safety
- Conventional commits for Git

### Git Commit Convention
```
feat: new feature
fix: bug fix
docs: documentation
style: formatting
refactor: code refactoring
test: adding tests
chore: maintenance
```

## 🔧 Configuration Files

- `vite.config.ts`: Vite build configuration
- `tsconfig.json`: TypeScript configuration
- `.eslintrc.json`: ESLint rules
- `jest.config.js`: Jest testing configuration
- `tailwind.config.js`: Tailwind CSS configuration

## 🚦 Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# API Integration
NOVAX_API_BASE=http://localhost:8001
NOVAX_API_KEY=your_api_key

# AI Integration
GEMINI_API_KEY=your_gemini_key

# Analytics
GOOGLE_ANALYTICS_ID=your_ga_id
PLAUSIBLE_DOMAIN=your_domain
```

## 📈 Performance Optimization Tips

1. **Code Splitting**: Already configured in vite.config.ts
2. **Lazy Loading**: Use React.lazy() for heavy components
3. **Image Optimization**: Use WebP format with fallbacks
4. **Bundle Analysis**: Regularly analyze bundle size
5. **Caching**: Implement service worker caching

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Commit with conventional messages
5. Push and create PR
6. Ensure CI checks pass

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For issues and questions:
- Check documentation in `/docs/`
- Review GitHub Issues
- Contact development team

---

**Last Updated**: 2026-06-12
**Version**: 1.0.0