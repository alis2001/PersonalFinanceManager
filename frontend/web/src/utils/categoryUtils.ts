import { Category } from '../services/categoryService';

// Category translation mappings
const categoryMap: { [key: string]: string } = {
  'Bills & Utilities': 'categories.billsUtilities',
  'Food & Dining': 'categories.foodDining',
  'Transportation': 'categories.transportation',
  'Shopping': 'categories.shopping',
  'Entertainment': 'categories.entertainment',
  'Healthcare': 'categories.healthcare',
  'Education': 'categories.education',
  'Travel': 'categories.travel',
  'Groceries': 'categories.groceries',
  'Gas': 'categories.gas',
  'Insurance': 'categories.insurance',
  'Other': 'categories.other',
  'Business': 'categories.business',
  'Business Income': 'categories.businessIncome',
  'Freelance': 'categories.freelance',
  'Gifts & Bonuses': 'categories.giftsBonuses',
  'Gifts & Donations': 'categories.giftsDonations',
  'Home & Garden': 'categories.homeGarden',
  'Investment Returns': 'categories.investmentReturns',
  'Other Expenses': 'categories.otherExpenses',
  'Other Income': 'categories.otherIncome',
  'Personal Care': 'categories.personalCare',
  'Rental Income': 'categories.rentalIncome',
  'Work': 'categories.work',
};

// Get translated category name
export const getTranslatedCategoryName = (categoryName: string, t: (key: string, params?: { [key: string]: string | number }) => string): string => {
  const translationKey = categoryMap[categoryName];
  return translationKey ? t(translationKey) : categoryName;
};

// Build hierarchical category name (e.g., "Home -> Food -> Groceries")
export const getHierarchicalCategoryName = (category: Category, categories: Category[], t: (key: string, params?: { [key: string]: string | number }) => string): string => {
  if (!category.parent_id) {
    return getTranslatedCategoryName(category.name, t);
  }

  const buildPath = (cat: Category): string[] => {
    const path = [getTranslatedCategoryName(cat.name, t)];
    if (cat.parent_id) {
      const parent = categories.find(c => c.id === cat.parent_id);
      if (parent) {
        return [...buildPath(parent), ...path];
      }
    }
    return path;
  };

  return buildPath(category).join(' → ');
};

// Check if a category is a leaf category (has no subcategories)
export const isLeafCategory = (category: Category, categories: Category[]): boolean => {
  return !categories.some(cat => cat.parent_id === category.id);
};

// Get only leaf categories (categories that can have expenses)
export const getLeafCategories = (categories: Category[]): Category[] => {
  return categories.filter(category => isLeafCategory(category, categories));
};

// Build category tree for dropdown/selector
export const buildCategoryTreeForSelector = (categories: Category[], t: (key: string, params?: { [key: string]: string | number }) => string) => {
  const roots = categories.filter(cat => !cat.parent_id);
  const map = new Map<string, Category & { children: Category[] }>();
  
  // Create map with children arrays
  categories.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] });
  });
  
  // Build tree structure
  roots.forEach(root => {
    const buildChildren = (parent: Category & { children: Category[] }) => {
      const children = categories.filter(cat => cat.parent_id === parent.id);
      parent.children = children.map(child => {
        const childWithChildren = map.get(child.id)!;
        buildChildren(childWithChildren);
        return childWithChildren;
      });
    };
    
    buildChildren(map.get(root.id)!);
  });
  
  return roots.map(root => map.get(root.id)!);
};
