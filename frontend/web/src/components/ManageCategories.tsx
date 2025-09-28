import React, { useState, useEffect } from 'react';
import categoryService from '../services/categoryService';
import { useTranslation } from '../hooks/useTranslation';
import type { Category } from '../services/categoryService';
import '../styles/ManageCategories.css';

interface ManageCategoriesProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  type: 'expense' | 'income' | 'both';
  is_active: boolean;
}

const defaultFormData: CategoryFormData = {
  name: '',
  description: '',
  color: '#4A90E2',
  icon: '💰',
  type: 'expense',
  is_active: true
};

const predefinedIcons = [
  '🍽️', '🚗', '🛍️', '🎬', '📄', '❤️', '📚', '✈️', '🏠', '✨', 
  '🎁', '💼', '🎯', '⚡', '📊', '💡', '🎨', '🎵', '🏃‍♂️', '☕',
  '📱', '💻', '🚀', '🌟', '🔧', '🎉', '💰', '📈', '🎮', '🌍'
];

const predefinedColors = [
  '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#85C1E9', '#F8C471', '#A9DFBF', '#F7DC6F', '#BB8FCE', '#82E0AA',
  '#AED6F1', '#F9E79F', '#D7BDE2', '#A3E4D7', '#FADBD8', '#D5DBDB'
];

const ManageCategories: React.FC<ManageCategoriesProps> = ({ 
  isOpen, 
  onClose, 
  onCategoriesUpdated 
}) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);

  // Function to translate category names
  const getTranslatedCategoryName = (categoryName: string): string => {
    const categoryMap: { [key: string]: string } = {
      'Bills & Utilities': t('categories.billsUtilities'),
      'Food & Dining': t('categories.foodDining'),
      'Transportation': t('categories.transportation'),
      'Shopping': t('categories.shopping'),
      'Entertainment': t('categories.entertainment'),
      'Healthcare': t('categories.healthcare'),
      'Education': t('categories.education'),
      'Travel': t('categories.travel'),
      'Groceries': t('categories.groceries'),
      'Gas': t('categories.gas'),
      'Insurance': t('categories.insurance'),
      'Other': t('categories.other'),
      'Business': t('categories.business'),
      'Business Income': t('categories.businessIncome'),
      'Freelance': t('categories.freelance'),
      'Gifts & Bonuses': t('categories.giftsBonuses'),
      'Gifts & Donations': t('categories.giftsDonations'),
      'Home & Garden': t('categories.homeGarden'),
      'Investment Returns': t('categories.investmentReturns'),
      'Other Expenses': t('categories.otherExpenses'),
      'Other Income': t('categories.otherIncome'),
      'Personal Care': t('categories.personalCare'),
      'Rental Income': t('categories.rentalIncome'),
    };
    return categoryMap[categoryName] || categoryName;
  };

  // Function to translate category types
  const getTranslatedCategoryType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'expense': t('categories.expense'),
      'income': t('categories.income'),
      'both': t('categories.both'),
    };
    return typeMap[type] || type;
  };

  // Function to translate category descriptions
  const getTranslatedCategoryDescription = (categoryName: string): string => {
    const descriptionMap: { [key: string]: string } = {
      'Bills & Utilities': t('categories.billsUtilitiesDesc'),
      'Food & Dining': t('categories.foodDiningDesc'),
      'Transportation': t('categories.transportationDesc'),
      'Shopping': t('categories.shoppingDesc'),
      'Entertainment': t('categories.entertainmentDesc'),
      'Healthcare': t('categories.healthcareDesc'),
      'Education': t('categories.educationDesc'),
      'Travel': t('categories.travelDesc'),
      'Groceries': t('categories.groceriesDesc'),
      'Gas': t('categories.gasDesc'),
      'Insurance': t('categories.insuranceDesc'),
      'Other': t('categories.otherDesc'),
      'Business': t('categories.businessDesc'),
      'Business Income': t('categories.businessIncomeDesc'),
      'Freelance': t('categories.freelanceDesc'),
      'Gifts & Bonuses': t('categories.giftsBonusesDesc'),
      'Gifts & Donations': t('categories.giftsDonationsDesc'),
      'Home & Garden': t('categories.homeGardenDesc'),
      'Investment Returns': t('categories.investmentReturnsDesc'),
      'Other Expenses': t('categories.otherExpensesDesc'),
      'Other Income': t('categories.otherIncomeDesc'),
      'Personal Care': t('categories.personalCareDesc'),
      'Rental Income': t('categories.rentalIncomeDesc'),
    };
    return descriptionMap[categoryName] || '';
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      resetMessages();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const result = await categoryService.getCategories({ active: undefined });
      if (result.success && result.categories) {
        setCategories(result.categories);
      } else {
        setError(t('categories.failedToLoadCategories'));
      }
    } catch (err) {
        setError(t('categories.failedToLoadCategories'));
    }
    setLoading(false);
  };

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleIconSelect = (icon: string) => {
    setFormData(prev => ({ ...prev, icon }));
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError(t('categories.categoryNameRequired'));
      return;
    }

    setFormLoading(true);
    resetMessages();

    try {
      let result;
      if (editingCategory) {
        result = await categoryService.updateCategory(editingCategory.id, formData);
      } else {
        result = await categoryService.createCategory(formData);
      }

      if (result.success) {
        setSuccess(result.message || t(editingCategory ? 'categories.categoryUpdated' : 'categories.categoryAdded'));
        resetForm();
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || t('categories.operationFailed'));
      }
    } catch (err) {
      setError(t('categories.operationFailedTryAgain'));
    }

    setFormLoading(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#4A90E2',
      icon: category.icon || '💰',
      type: category.type,
      is_active: category.is_active
    });
    setShowForm(true);
    resetMessages();
  };

  const handleDelete = async (categoryId: string) => {
    if (deleteConfirm !== categoryId) {
      setDeleteConfirm(categoryId);
      return;
    }

    try {
      const result = await categoryService.deleteCategory(categoryId);
      if (result.success) {
        setSuccess(t('categories.categoryDeleted'));
        setDeleteConfirm(null);
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || t('categories.failedToDeleteCategory'));
      }
    } catch (err) {
      setError(t('categories.failedToDeleteCategory'));
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const result = await categoryService.updateCategory(category.id, {
        is_active: !category.is_active
      });
      
      if (result.success) {
        setSuccess(t(!category.is_active ? 'categories.categoryActivated' : 'categories.categoryDeactivated'));
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || t('categories.failedToUpdateCategory'));
      }
    } catch (err) {
      setError(t('categories.failedToUpdateCategory'));
    }
  };

  const handleClose = () => {
    resetForm();
    resetMessages();
    setDeleteConfirm(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="manage-categories-overlay" onClick={handleClose}>
      <div className="manage-categories-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manage-categories-header">
          <h2>{t('categories.manageCategories')}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="manage-categories-content">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {!showForm ? (
            <div className="categories-list">
              <div className="list-header">
                <h3>{t('categories.yourCategories', { count: categories.length })}</h3>
                <button 
                  className="btn-add-category"
                  onClick={() => setShowForm(true)}
                >
                  <span>+</span> {t('categories.addCategory')}
                </button>
              </div>

              {loading ? (
                <div className="loading-state">{t('categories.loadingCategories')}</div>
              ) : categories.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏷️</div>
                  <p>{t('categories.noCategoriesFound')}</p>
                  <button 
                    className="btn-primary"
                    onClick={() => setShowForm(true)}
                  >
                    {t('categories.createFirstCategory')}
                  </button>
                </div>
              ) : (
                <div className="categories-grid">
                  {categories.map((category) => (
                    <div 
                      key={category.id} 
                      className={`category-card ${!category.is_active ? 'inactive' : ''}`}
                    >
                      <div className="category-header">
                        <div 
                          className="category-icon"
                          style={{ backgroundColor: category.color + '20', color: category.color }}
                        >
                          {category.icon}
                        </div>
                        <div className="category-info">
                          <h4>{getTranslatedCategoryName(category.name)}</h4>
                          <span className={`type-badge ${category.type}`}>
                            {getTranslatedCategoryType(category.type)}
                          </span>
                        </div>
                        <div className="category-status">
                          {category.is_active ? (
                            <span className="status-active">{t('categories.active')}</span>
                          ) : (
                            <span className="status-inactive">{t('categories.inactive')}</span>
                          )}
                        </div>
                      </div>
                      
                      {getTranslatedCategoryDescription(category.name) && (
                        <p className="category-description">{getTranslatedCategoryDescription(category.name)}</p>
                      )}
                      
                      <div className="category-actions">
                        <button 
                          className="btn-edit"
                          onClick={() => handleEdit(category)}
                        >
                          {t('common.edit')}
                        </button>
                        <button 
                          className={`btn-toggle ${category.is_active ? 'deactivate' : 'activate'}`}
                          onClick={() => handleToggleActive(category)}
                        >
                          {category.is_active ? t('categories.deactivate') : t('categories.activate')}
                        </button>
                        <button 
                          className={`btn-delete ${deleteConfirm === category.id ? 'confirm' : ''}`}
                          onClick={() => handleDelete(category.id)}
                        >
                          {deleteConfirm === category.id ? t('categories.confirmDelete') : t('common.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="category-form">
              <div className="form-header">
                <h3>{editingCategory ? t('categories.editCategory') : t('categories.addNewCategory')}</h3>
                <button 
                  className="btn-back"
                  onClick={resetForm}
                >
                  ← {t('categories.backToList')}
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">{t('categories.categoryName')} *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={formLoading}
                    maxLength={100}
                    placeholder={t('categories.enterCategoryName')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">{t('categories.description')}</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={formLoading}
                    maxLength={500}
                    placeholder={t('categories.optionalDescription')}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="type">{t('categories.categoryType')} *</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    disabled={formLoading}
                  >
                    <option value="expense">{t('categories.expense')}</option>
                    <option value="income">{t('categories.income')}</option>
                    <option value="both">{t('categories.both')}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('categories.icon')}</label>
                  <div className="icon-selector">
                    {predefinedIcons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-option ${formData.icon === icon ? 'selected' : ''}`}
                        onClick={() => handleIconSelect(icon)}
                        disabled={formLoading}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('categories.color')}</label>
                  <div className="color-selector">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${formData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorSelect(color)}
                        disabled={formLoading}
                      />
                    ))}
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      disabled={formLoading}
                    />
                    <span className="checkmark"></span>
                    {t('categories.activeCategory')}
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={resetForm}
                    disabled={formLoading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={formLoading}
                  >
                    {formLoading ? t('categories.saving') : (editingCategory ? t('categories.updateCategory') : t('categories.createCategory'))}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageCategories;