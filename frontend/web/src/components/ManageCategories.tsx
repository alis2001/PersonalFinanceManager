import React, { useState, useEffect } from 'react';
import categoryService from '../services/categoryService';
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
  const [categories, setCategories] = useState<Category[]>([]);
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
        setError('Failed to load categories');
      }
    } catch (err) {
      setError('Failed to load categories');
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
      setError('Category name is required');
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
        setSuccess(result.message || `Category ${editingCategory ? 'updated' : 'created'} successfully!`);
        resetForm();
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || 'Operation failed');
      }
    } catch (err) {
      setError('Operation failed. Please try again.');
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
        setSuccess('Category deleted successfully!');
        setDeleteConfirm(null);
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || 'Failed to delete category');
      }
    } catch (err) {
      setError('Failed to delete category');
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const result = await categoryService.updateCategory(category.id, {
        is_active: !category.is_active
      });
      
      if (result.success) {
        setSuccess(`Category ${!category.is_active ? 'activated' : 'deactivated'} successfully!`);
        await loadCategories();
        onCategoriesUpdated();
      } else {
        setError(result.error || 'Failed to update category');
      }
    } catch (err) {
      setError('Failed to update category');
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
          <h2>Manage Categories</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="manage-categories-content">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {!showForm ? (
            <div className="categories-list">
              <div className="list-header">
                <h3>Your Categories ({categories.length})</h3>
                <button 
                  className="btn-add-category"
                  onClick={() => setShowForm(true)}
                >
                  <span>+</span> Add Category
                </button>
              </div>

              {loading ? (
                <div className="loading-state">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏷️</div>
                  <p>No categories found</p>
                  <button 
                    className="btn-primary"
                    onClick={() => setShowForm(true)}
                  >
                    Create Your First Category
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
                          <h4>{category.name}</h4>
                          <span className={`type-badge ${category.type}`}>
                            {category.type}
                          </span>
                        </div>
                        <div className="category-status">
                          {category.is_active ? (
                            <span className="status-active">Active</span>
                          ) : (
                            <span className="status-inactive">Inactive</span>
                          )}
                        </div>
                      </div>
                      
                      {category.description && (
                        <p className="category-description">{category.description}</p>
                      )}
                      
                      <div className="category-actions">
                        <button 
                          className="btn-edit"
                          onClick={() => handleEdit(category)}
                        >
                          Edit
                        </button>
                        <button 
                          className={`btn-toggle ${category.is_active ? 'deactivate' : 'activate'}`}
                          onClick={() => handleToggleActive(category)}
                        >
                          {category.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          className={`btn-delete ${deleteConfirm === category.id ? 'confirm' : ''}`}
                          onClick={() => handleDelete(category.id)}
                        >
                          {deleteConfirm === category.id ? 'Confirm Delete' : 'Delete'}
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
                <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
                <button 
                  className="btn-back"
                  onClick={resetForm}
                >
                  ← Back to List
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Category Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={formLoading}
                    maxLength={100}
                    placeholder="Enter category name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={formLoading}
                    maxLength={500}
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="type">Category Type *</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    disabled={formLoading}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Icon</label>
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
                  <label>Color</label>
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
                    Active Category
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={resetForm}
                    disabled={formLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={formLoading}
                  >
                    {formLoading ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
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