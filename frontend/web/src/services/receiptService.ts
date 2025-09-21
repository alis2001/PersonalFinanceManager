// frontend/web/src/services/receiptService.ts
// Receipt Processing Service - API Integration Layer
// Follows existing service patterns with full env var usage and gateway proxying

import type { Category } from './categoryService';

interface ReceiptJob {
  id: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  fileType: string;
  status: 'uploaded' | 'processing' | 'ocr_completed' | 'ai_processing' | 'completed' | 'failed' | 'approved' | 'rejected';
  totalTransactions: number;
  processedTransactions: number;
  approvedTransactions: number;
  ocrText?: string;
  ocrConfidence?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  processingTimeMs?: number;
}

interface ReceiptTransaction {
  id: string;
  jobId: string;
  transactionIndex: number;
  merchantName: string;
  amount: number;
  currency: string;
  transactionDate: string;
  description: string;
  categorySuggestion: string;
  confidence: number;
  rawTextSnippet: string;
  status: 'pending' | 'validated' | 'approved' | 'rejected' | 'expense_created';
  suggestedCategoryId?: string;
  expenseId?: string;
  userApprovedAt?: string;
  userRejectedAt?: string;
  rejectionReason?: string;
}

interface UploadResponse {
  success: boolean;
  jobId?: string;
  job?: ReceiptJob;
  error?: string;
  message?: string;
}

interface ProcessingStatusResponse {
  success: boolean;
  job?: ReceiptJob;
  transactions?: {
    detected: number;
    processed: number;
    approved: number;
    pending: number;
    details: ReceiptTransaction[];
  };
  ocr?: {
    textLength: number;
    confidence: number;
    provider: string;
  };
  processingTimeMs?: number;
  error?: string;
}

interface JobsResponse {
  success: boolean;
  jobs?: ReceiptJob[];
  total?: number;
  error?: string;
}

interface ApprovalResponse {
  success: boolean;
  expenseId?: string;
  transactionId?: string;
  error?: string;
  message?: string;
}

class ReceiptService {
  // Use environment variables through gateway - no hardcoded URLs
  private baseURL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8080';
  private receiptURL = `${this.baseURL}/api/receipt`;

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('accessToken');
    return {
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private getAuthHeadersWithoutContentType(): Record<string, string> {
    const token = localStorage.getItem('accessToken');
    return {
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse(response: Response): Promise<any> {
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        const refreshSuccess = await this.refreshToken();
        if (!refreshSuccess) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          throw new Error('Authentication required');
        }
        throw new Error('Token refreshed, retry request');
      }
      throw new Error(data.error || data.detail || 'Request failed');
    }
    
    return data;
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tokens) {
          localStorage.setItem('accessToken', data.tokens.accessToken);
          localStorage.setItem('refreshToken', data.tokens.refreshToken);
          return true;
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  async uploadReceipt(file: File): Promise<UploadResponse> {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.receiptURL}/upload`, {
        method: 'POST',
        headers: this.getAuthHeadersWithoutContentType(),
        body: formData
        });

        const data = await this.handleResponse(response);
        
        // Map backend snake_case to frontend camelCase
        return { 
        success: true, 
        jobId: data.job_id,  // Map job_id to jobId
        job: data.job,
        message: data.message 
        };
    } catch (error: any) {
        console.error('Upload receipt error:', error);
        if (error.message === 'Token refreshed, retry request') {
        return this.uploadReceipt(file);
        }
        return { success: false, error: error.message };
    }
  }

  async getProcessingStatus(jobId: string): Promise<ProcessingStatusResponse> {
    try {
      const response = await fetch(`${this.receiptURL}/status/${jobId}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, ...data };
    } catch (error: any) {
      console.error('Get processing status error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getProcessingStatus(jobId);
      }
      return { success: false, error: error.message };
    }
  }

  async getUserJobs(limit: number = 20): Promise<JobsResponse> {
    try {
      const response = await fetch(`${this.receiptURL}/jobs?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });

      const data = await this.handleResponse(response);
      return { success: true, ...data };
    } catch (error: any) {
      console.error('Get user jobs error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.getUserJobs(limit);
      }
      return { success: false, error: error.message };
    }
  }

  async approveTransaction(jobId: string, transactionId: string, expenseData?: {
    categoryId?: string;
    description?: string;
    amount?: number;
    transactionDate?: string;
  }): Promise<ApprovalResponse> {
    try {
      const response = await fetch(`${this.receiptURL}/approve/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({
          transactionId,
          expenseData
        })
      });

      const data = await this.handleResponse(response);
      return { success: true, ...data };
    } catch (error: any) {
      console.error('Approve transaction error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.approveTransaction(jobId, transactionId, expenseData);
      }
      return { success: false, error: error.message };
    }
  }

  async rejectTransaction(jobId: string, transactionId: string, reason?: string): Promise<ApprovalResponse> {
    try {
      const response = await fetch(`${this.receiptURL}/reject/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({
          transactionId,
          reason
        })
      });

      const data = await this.handleResponse(response);
      return { success: true, ...data };
    } catch (error: any) {
      console.error('Reject transaction error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.rejectTransaction(jobId, transactionId, reason);
      }
      return { success: false, error: error.message };
    }
  }

  async startProcessing(jobId: string, userCategories?: Category[]): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.receiptURL}/process/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({
          userCategories: userCategories?.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            icon: cat.icon,
            color: cat.color
          }))
        })
      });

      const data = await this.handleResponse(response);
      return { success: true };
    } catch (error: any) {
      console.error('Start processing error:', error);
      if (error.message === 'Token refreshed, retry request') {
        return this.startProcessing(jobId, userCategories);
      }
      return { success: false, error: error.message };
    }
  }

  async downloadReceipt(jobId: string): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.receiptURL}/download/${jobId}`, {
        headers: this.getAuthHeadersWithoutContentType()
      });

      if (response.ok) {
        return await response.blob();
      }
      return null;
    } catch (error) {
      console.error('Download receipt error:', error);
      return null;
    }
  }

  // Category validation methods
  validateTransactionCategories(transactions: ReceiptTransaction[], userCategories: Category[]): {
    valid: boolean;
    errors: string[];
    invalidTransactions: { transaction: ReceiptTransaction; error: string; }[];
  } {
    const errors: string[] = [];
    const invalidTransactions: { transaction: ReceiptTransaction; error: string; }[] = [];
    
    for (const transaction of transactions) {
      const categoryMatch = this.findCategoryMatch(transaction.categorySuggestion, userCategories);
      
      if (!categoryMatch.found) {
        const error = `Category "${transaction.categorySuggestion}" not found in your categories. Please add this category first.`;
        errors.push(error);
        invalidTransactions.push({ transaction, error });
      } else if (categoryMatch.confidence < 0.7) {
        const error = `Low confidence match for category "${transaction.categorySuggestion}". Please verify or add exact category.`;
        errors.push(error);
        invalidTransactions.push({ transaction, error });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      invalidTransactions
    };
  }

  findCategoryMatch(suggestionName: string, userCategories: Category[]): {
    found: boolean;
    category?: Category;
    confidence: number;
  } {
    // Exact match first
    const exactMatch = userCategories.find(cat => 
      cat.name.toLowerCase() === suggestionName.toLowerCase()
    );
    
    if (exactMatch) {
      return { found: true, category: exactMatch, confidence: 1.0 };
    }
    
    // Partial match with similarity scoring
    let bestMatch: Category | undefined;
    let bestScore = 0;
    
    for (const category of userCategories) {
      const score = this.calculateSimilarity(suggestionName.toLowerCase(), category.name.toLowerCase());
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = category;
      }
    }
    
    return {
      found: bestMatch !== undefined,
      category: bestMatch,
      confidence: bestScore
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation - can be enhanced
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // Check for common words
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  getCategoryValidationErrors(transactions: ReceiptTransaction[], userCategories: Category[]): string[] {
    const validation = this.validateTransactionCategories(transactions, userCategories);
    return validation.errors;
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isImageFile(fileType: string): boolean {
    return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.gif'].includes(fileType.toLowerCase());
  }

  isPdfFile(fileType: string): boolean {
    return fileType.toLowerCase() === '.pdf';
  }

  getFileIcon(fileType: string): string {
    if (this.isImageFile(fileType)) return '🖼️';
    if (this.isPdfFile(fileType)) return '📄';
    if (['.xlsx', '.xls'].includes(fileType.toLowerCase())) return '📊';
    if (fileType.toLowerCase() === '.csv') return '📋';
    return '📄';
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'uploaded': return '📤';
      case 'processing': return '⚙️';
      case 'ocr_completed': return '👁️';
      case 'ai_processing': return '🤖';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'approved': return '✅';
      case 'rejected': return '❌';
      default: return '📄';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'uploaded': return '#3182ce';
      case 'processing': return '#d69e2e';
      case 'ocr_completed': return '#805ad5';
      case 'ai_processing': return '#805ad5';
      case 'completed': return '#38a169';
      case 'failed': return '#e53e3e';
      case 'approved': return '#38a169';
      case 'rejected': return '#e53e3e';
      default: return '#718096';
    }
  }
}

export default new ReceiptService();
export type { ReceiptJob, ReceiptTransaction, UploadResponse, ProcessingStatusResponse, JobsResponse, ApprovalResponse };