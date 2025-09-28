// frontend/web/src/components/ReceiptUpload.tsx
// Receipt Upload Component - Following Existing UI/UX Design Patterns

import React, { useState, useRef, useCallback, useEffect } from 'react';
import receiptService from '../services/receiptService';
import categoryService from '../services/categoryService';
import dateConversionService from '../services/dateConversionService';
import { useTranslation } from '../hooks/useTranslation';
import type { UploadResponse, ProcessingStatusResponse, ReceiptTransaction } from '../services/receiptService';
import type { Category } from '../services/categoryService';
import AddExpense from './AddExpense';
import '../styles/ReceiptUpload.css';

interface ReceiptUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptProcessed: () => void;
}

const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ isOpen, onClose, onReceiptProcessed }) => {
  const { t, currentLanguage } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Category and transaction workflow states
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<ReceiptTransaction[]>([]);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [processedTransactions, setProcessedTransactions] = useState<string[]>([]);
  const [categoryValidationErrors, setCategoryValidationErrors] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Supported file types (matching backend)
  const supportedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv', 'text/plain'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  // Load user categories on component mount
  useEffect(() => {
    if (isOpen) {
      loadUserCategories();
    }
  }, [isOpen]);

  const loadUserCategories = async () => {
    try {
      const result = await categoryService.getExpenseCategories();
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setUploading(false);
    setProcessing(false);
    setUploadProgress(0);
    setJobId(null);
    setProcessingStatus(null);
    setError(null);
    setSuccess(null);
    setTransactions([]);
    setCurrentTransactionIndex(0);
    setShowAddExpense(false);
    setProcessedTransactions([]);
    setCategoryValidationErrors([]);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validateFile = (file: File): string | null => {
    if (!supportedTypes.includes(file.type)) {
      return 'File type not supported. Please upload images, PDFs, Excel files, or CSV files.';
    }
    
    if (file.size > maxFileSize) {
      return 'File size too large. Maximum size is 10MB.';
    }
    
    return null;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setSelectedFile(file);
    }
  };

  const startStatusPolling = (jobId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    console.log('🔄 Starting status polling for job:', jobId);

    pollIntervalRef.current = setInterval(async () => {
      try {
        console.log('📡 Polling status for job:', jobId);
        const result = await receiptService.getProcessingStatus(jobId);
        
        console.log('📊 Status result:', {
          success: result.success,
          status: result.job?.status,
          transactionsCount: result.transactions?.details?.length || 0,
          hasTransactions: !!result.transactions?.details,
          categoriesLoaded: categories.length
        });
        
        if (result.success && result.job) {
          setProcessingStatus(result);
          
          console.log('🎯 Processing status:', result.job.status);
          
          if (result.job.status === 'completed') {
            console.log('✅ Job completed! Processing transactions...');
            setProcessing(false);
            
            // CRITICAL FIX: Better handling of completed status
            const transactionDetails = result.transactions?.details;
            
            console.log('🔍 Transaction details:', {
              hasDetails: !!transactionDetails,
              detailsLength: transactionDetails?.length || 0,
              categoriesLength: categories.length,
              firstTransaction: transactionDetails?.[0]
            });
            
            // Check if we have transactions and categories loaded
            if (transactionDetails && transactionDetails.length > 0 && categories.length > 0) {
              console.log('🎉 Found transactions and categories, validating...');
              
              // Validate categories before proceeding
              const validationErrors = receiptService.getCategoryValidationErrors(transactionDetails, categories);
              
              console.log('🔎 Category validation:', {
                errorsCount: validationErrors.length,
                errors: validationErrors
              });
              
              if (validationErrors.length > 0) {
                // Show category validation errors
                setCategoryValidationErrors(validationErrors);
                setError('Category validation failed. Please manage your categories first.');
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
              } else {
                // All categories valid - proceed to transaction forms
                console.log('🚀 Categories valid, proceeding to transaction approval');
                setTransactions(transactionDetails);
                setCurrentTransactionIndex(0);
                setShowAddExpense(true);
                setSuccess(`Processing completed! Found ${transactionDetails.length} transactions. Review each transaction below.`);
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
              }
            } else if (!transactionDetails || transactionDetails.length === 0) {
              console.log('❌ No transactions found');
              setError('No transactions found in the processed receipt.');
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            } else if (categories.length === 0) {
              console.log('❌ No categories loaded');
              setError('Categories not loaded. Please manage your categories first.');
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          } else if (result.job.status === 'failed') {
            console.log('❌ Job failed:', result.job.errorMessage);
            setProcessing(false);
            setError(result.job.errorMessage || 'Processing failed');
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } else {
            console.log('⏳ Job still processing, status:', result.job.status);
          }
        } else {
          console.error('❌ Status polling failed:', result.error);
          setError(result.error || 'Failed to get status');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('❌ Status polling error:', error);
        setError('Network error while checking status');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (categories.length === 0) {
      setError('Please manage your categories first before uploading receipts.');
      return;
    }

    setUploading(true);
    setError(null);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await receiptService.uploadReceipt(selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (result.success && result.jobId) {
        setJobId(result.jobId);
        setUploading(false);
        setProcessing(true);
        
        // Start processing with user categories for AI matching
        const processingResult = await receiptService.startProcessing(result.jobId, categories);
        
        if (processingResult.success) {
          startStatusPolling(result.jobId);
        } else {
          setProcessing(false);
          setError(processingResult.error || 'Failed to start processing');
        }
      } else {
        setUploading(false);
        setError(result.error || 'Upload failed');
      }
    } catch (error: any) {
      setUploading(false);
      setError(error.message || 'Upload failed');
    }
  };

  const getStatusMessage = () => {
    if (!processingStatus?.job) return 'Processing...';
    
    switch (processingStatus.job.status) {
      case 'uploaded': return 'File uploaded successfully';
      case 'processing': return 'Analyzing file...';
      case 'ocr_completed': return 'Text extracted, processing with AI...';
      case 'ai_processing': return 'AI extracting transaction data...';
      case 'completed': return 'Processing completed!';
      case 'failed': return 'Processing failed';
      default: return 'Processing...';
    }
  };

  // Transaction workflow handlers
  const handleAddExpenseSuccess = () => {
    const currentTransaction = transactions[currentTransactionIndex];
    setProcessedTransactions(prev => [...prev, currentTransaction.id]);
    
    // Move to next transaction or complete
    if (currentTransactionIndex < transactions.length - 1) {
      setCurrentTransactionIndex(prev => prev + 1);
      setShowAddExpense(true); // Keep showing for next transaction
    } else {
      // All transactions processed
      setShowAddExpense(false);
      setSuccess(`All ${transactions.length} transactions have been processed successfully!`);
      onReceiptProcessed();
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  };

  const handleSkipTransaction = () => {
    // Move to next transaction without saving
    if (currentTransactionIndex < transactions.length - 1) {
      setCurrentTransactionIndex(prev => prev + 1);
    } else {
      // Last transaction - show completion
      setShowAddExpense(false);
      setSuccess(`Receipt processing completed! ${processedTransactions.length} of ${transactions.length} transactions saved.`);
      onReceiptProcessed();
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  };

  const getCurrentTransaction = () => {
    return transactions[currentTransactionIndex] || null;
  };

  const getPrefilledExpenseData = () => {
    const transaction = getCurrentTransaction();
    if (!transaction) return {};

    // Helper function to format date for datetime-local input
    const formatDateTimeForInput = (dateString: string): string => {
      if (!dateString) return '';
      
      try {
        // Use the date conversion service to ensure consistent formatting
        // The service handles both Persian and Gregorian dates properly
        const result = dateConversionService.persianToGregorian(dateString, true);
        if (result.isValid) {
          return result.gregorianDate;
        }
        
        // Fallback to direct conversion if the service fails
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        // For datetime-local input, we need YYYY-MM-DDTHH:MM format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        // Set default time to 12:00 (noon) if no time is provided
        const hours = String(date.getHours() || 12).padStart(2, '0');
        const minutes = String(date.getMinutes() || 0).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return '';
      }
    };

    // Find matching category from user's categories  
    const categoryMatch = receiptService.findCategoryMatch(transaction.categorySuggestion, categories);
    
    // DEBUG: Check date format
    console.log('🗓️ Date debug:', {
      originalDate: transaction.transactionDate,
      formattedDateTime: formatDateTimeForInput(transaction.transactionDate),
      dateType: typeof transaction.transactionDate
    });
    
    return {
      amount: transaction.amount,
      description: transaction.description,
      categoryId: categoryMatch.found ? categoryMatch.category?.id || '' : '',
      transactionDate: formatDateTimeForInput(transaction.transactionDate),
      location: transaction.merchantName,
      notes: `Imported from receipt processing (Confidence: ${Math.round(transaction.confidence * 100)}%)`
    };
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content receipt-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('receipt.uploadReceipt')}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {!selectedFile && !uploading && !processing && !showAddExpense && (
            <div
              className={`file-drop-zone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="drop-zone-content">
                <div className="upload-icon">📎</div>
                <h3>{t('receipt.dropReceiptHere')}</h3>
                <p>{t('receipt.orClickToBrowse')}</p>
                <div className="supported-formats">
                  <span>{t('receipt.supportedFormats')}</span>
                  <span>{t('receipt.maxSize')}</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.bmp,.tiff,.pdf,.xlsx,.xls,.csv,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {selectedFile && !uploading && !processing && !showAddExpense && (
            <div className="file-preview">
              <div className="file-info">
                <div className="file-icon">{receiptService.getFileIcon(selectedFile.name.split('.').pop() || '')}</div>
                <div className="file-details">
                  <h4>{selectedFile.name}</h4>
                  <p>{receiptService.formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <div className="upload-actions">
                <button 
                  className="btn-secondary" 
                  onClick={() => setSelectedFile(null)}
                >
                  {t('receipt.remove')}
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleUpload}
                >
                  {t('receipt.uploadAndProcess')}
                </button>
              </div>
            </div>
          )}

          {uploading && (
            <div className="upload-progress">
              <div className="progress-info">
                <h3>{t('receipt.uploading')}</h3>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="file-name">{selectedFile?.name}</p>
            </div>
          )}

          {processing && (
            <div className="processing-status">
              <div className="processing-spinner">
                <div className="spinner"></div>
              </div>
              <h3>{getStatusMessage()}</h3>
              {processingStatus?.job && (
                <div className="status-details">
                  <p>{t('receipt.status')}: {processingStatus.job.status}</p>
                  {processingStatus.transactions && (
                    <p>{t('receipt.transactionsDetected')}: {processingStatus.transactions.detected}</p>
                  )}
                  {processingStatus.processingTimeMs && (
                    <p>{t('receipt.processingTime')}: {Math.round(processingStatus.processingTimeMs)}ms</p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">❌</span>
              {error}
              {categoryValidationErrors.length > 0 && (
                <div className="category-errors">
                  <h4>{t('receipt.categoryIssuesFound')}</h4>
                  <ul>
                    {categoryValidationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                  <p className="error-guidance">
                    <strong>{t('receipt.please')}:</strong> {t('receipt.categoryGuidance')}
                  </p>
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="success-message">
              <span className="success-icon">✅</span>
              {success}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!processing && !showAddExpense && (
            <button className="btn-secondary" onClick={handleClose}>
              {success ? t('common.close') : t('common.cancel')}
            </button>
          )}
          
          {showAddExpense && (
            <div className="transaction-navigation">
              <span className="transaction-counter">
                {t('receipt.transactionCounter', { current: currentTransactionIndex + 1, total: transactions.length })}
              </span>
              <div className="nav-buttons">
                <button className="btn-secondary" onClick={handleSkipTransaction}>
                  {t('receipt.skipTransaction')}
                </button>
                <button className="btn-secondary" onClick={handleClose}>
                  {t('receipt.cancelAll')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AddExpense Modal for Transaction Processing */}
      {showAddExpense && getCurrentTransaction() && (
        <AddExpense 
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={handleAddExpenseSuccess}
          prefilledData={getPrefilledExpenseData()}
          title={t('receipt.addExpenseTransaction', { current: currentTransactionIndex + 1, total: transactions.length })}
          fromReceipt={true}
        />
      )}
    </div>
  );
};

export default ReceiptUpload;