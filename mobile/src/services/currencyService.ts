// Currency Service - Single Currency per Account
// Handles currency formatting, validation, and user preferences

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  decimalPlaces: number;
}

export interface CurrencyPreferences {
  currency: string;
  locale: string;
}

class CurrencyService {
  // Supported currencies with their formatting details
  private supportedCurrencies: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalPlaces: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE', decimalPlaces: 2 },
    { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', decimalPlaces: 2 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', decimalPlaces: 0 },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA', decimalPlaces: 2 },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU', decimalPlaces: 2 },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH', decimalPlaces: 2 },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN', decimalPlaces: 2 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN', decimalPlaces: 2 },
    { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', locale: 'fa-IR', decimalPlaces: 0 },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR', decimalPlaces: 2 },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$', locale: 'es-MX', decimalPlaces: 2 },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG', decimalPlaces: 2 },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'en-HK', decimalPlaces: 2 },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ', decimalPlaces: 2 },
    { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', locale: 'sv-SE', decimalPlaces: 2 },
    { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', locale: 'nb-NO', decimalPlaces: 2 },
    { code: 'DKK', name: 'Danish Krone', symbol: 'kr', locale: 'da-DK', decimalPlaces: 2 },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', locale: 'pl-PL', decimalPlaces: 2 },
    { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', locale: 'cs-CZ', decimalPlaces: 2 },
    { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', locale: 'hu-HU', decimalPlaces: 2 },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽', locale: 'ru-RU', decimalPlaces: 2 },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR', decimalPlaces: 2 },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA', decimalPlaces: 2 },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR', decimalPlaces: 0 },
    { code: 'THB', name: 'Thai Baht', symbol: '฿', locale: 'th-TH', decimalPlaces: 2 },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', locale: 'ms-MY', decimalPlaces: 2 },
    { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', locale: 'id-ID', decimalPlaces: 0 },
    { code: 'PHP', name: 'Philippine Peso', symbol: '₱', locale: 'en-PH', decimalPlaces: 2 },
    { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', locale: 'vi-VN', decimalPlaces: 0 },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE', decimalPlaces: 2 },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', locale: 'ar-SA', decimalPlaces: 2 },
    { code: 'EGP', name: 'Egyptian Pound', symbol: '£', locale: 'ar-EG', decimalPlaces: 2 },
    { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', locale: 'he-IL', decimalPlaces: 2 },
    { code: 'RON', name: 'Romanian Leu', symbol: 'lei', locale: 'ro-RO', decimalPlaces: 2 },
    { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', locale: 'bg-BG', decimalPlaces: 2 },
    { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', locale: 'hr-HR', decimalPlaces: 2 },
    { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', locale: 'sr-RS', decimalPlaces: 2 },
    { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', locale: 'uk-UA', decimalPlaces: 2 },
    { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', locale: 'be-BY', decimalPlaces: 2 },
    { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', locale: 'kk-KZ', decimalPlaces: 2 },
    { code: 'UZS', name: 'Uzbekistani Som', symbol: 'so\'m', locale: 'uz-UZ', decimalPlaces: 2 },
    { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с', locale: 'ky-KG', decimalPlaces: 2 },
    { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM', locale: 'tg-TJ', decimalPlaces: 2 },
    { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'T', locale: 'tk-TM', decimalPlaces: 2 },
    { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', locale: 'fa-AF', decimalPlaces: 2 },
    { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', locale: 'ur-PK', decimalPlaces: 2 },
    { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', locale: 'bn-BD', decimalPlaces: 2 },
    { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨', locale: 'si-LK', decimalPlaces: 2 },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨', locale: 'ne-NP', decimalPlaces: 2 },
    { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.', locale: 'dz-BT', decimalPlaces: 2 },
    { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: '.ރ', locale: 'dv-MV', decimalPlaces: 2 },
    { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', locale: 'my-MM', decimalPlaces: 2 },
    { code: 'LAK', name: 'Lao Kip', symbol: '₭', locale: 'lo-LA', decimalPlaces: 2 },
    { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', locale: 'km-KH', decimalPlaces: 2 },
    { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', locale: 'ms-BN', decimalPlaces: 2 },
    { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', locale: 'en-FJ', decimalPlaces: 2 },
    { code: 'PGK', name: 'Papua New Guinea Kina', symbol: 'K', locale: 'en-PG', decimalPlaces: 2 },
    { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', locale: 'en-SB', decimalPlaces: 2 },
    { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'Vt', locale: 'bi-VU', decimalPlaces: 0 },
    { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', locale: 'sm-WS', decimalPlaces: 2 },
    { code: 'TOP', name: 'Tongan Pa\'anga', symbol: 'T$', locale: 'to-TO', decimalPlaces: 2 },
    { code: 'KID', name: 'Kiribati Dollar', symbol: '$', locale: 'en-KI', decimalPlaces: 2 },
    { code: 'TVD', name: 'Tuvaluan Dollar', symbol: '$', locale: 'en-TV', decimalPlaces: 2 }
  ];

  // Get all supported currencies
  getSupportedCurrencies(): Currency[] {
    return this.supportedCurrencies;
  }

  // Get currency by code
  getCurrencyByCode(code: string): Currency | undefined {
    return this.supportedCurrencies.find(currency => currency.code === code);
  }

  // Validate currency code
  isValidCurrency(code: string): boolean {
    return this.supportedCurrencies.some(currency => currency.code === code);
  }

  // Format currency amount
  formatCurrency(amount: number, currencyCode: string = 'USD'): string {
    const currency = this.getCurrencyByCode(currencyCode);
    if (!currency) {
      // Fallback to USD if currency not found
      return `${amount.toFixed(2)}`;
    }

    // For React Native, we'll use a simple format since Intl.NumberFormat might not be fully supported
    const formattedAmount = amount.toFixed(currency.decimalPlaces);
    return `${currency.symbol}${formattedAmount}`;
  }

  // Get currency symbol
  getCurrencySymbol(currencyCode: string): string {
    const currency = this.getCurrencyByCode(currencyCode);
    return currency ? currency.symbol : '$';
  }

  // Get currency name
  getCurrencyName(currencyCode: string): string {
    const currency = this.getCurrencyByCode(currencyCode);
    return currency ? currency.name : 'US Dollar';
  }

  // Get popular currencies (most commonly used)
  getPopularCurrencies(): Currency[] {
    const popularCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'IRR', 'BRL'];
    return this.supportedCurrencies.filter(currency => popularCodes.indexOf(currency.code) !== -1);
  }

  // Get all currencies (for the register form)
  getAllCurrencies(): Currency[] {
    return this.supportedCurrencies;
  }

  // Get currencies by region
  getCurrenciesByRegion(region: string): Currency[] {
    const regionMap: { [key: string]: string[] } = {
      'americas': ['USD', 'CAD', 'BRL', 'MXN'],
      'europe': ['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RSD'],
      'asia': ['JPY', 'CNY', 'INR', 'KRW', 'SGD', 'HKD', 'THB', 'MYR', 'IDR', 'PHP', 'VND'],
      'oceania': ['AUD', 'NZD', 'FJD', 'PGK', 'SBD', 'VUV', 'WST', 'TOP'],
      'africa': ['ZAR', 'EGP'],
      'middle-east': ['AED', 'SAR', 'ILS', 'IRR']
    };

    const regionCodes = regionMap[region.toLowerCase()] || [];
    return this.supportedCurrencies.filter(currency => regionCodes.indexOf(currency.code) !== -1);
  }

  // Get suggested currency for new user
  getSuggestedCurrency(): string {
    // For mobile, default to USD
    return 'USD';
  }
}

// Export singleton instance
export const currencyService = new CurrencyService();
export default currencyService;