import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/auth';
import type {
  ChequeReturnResult,
  CustomerPayload,
  CustomerPaymentRecord,
  OutstandingBill,
  ReceivePaymentPayload,
  ReceivePaymentResult,
} from '@/types/customers';
import type { CustomerSummary } from '@/types/sales';
import type { CustomerListResult } from '@/types/customers';

const normalizeCustomer = (row: CustomerSummary): CustomerSummary => ({
  ...row,
  address: row.address ?? row.address_line1 ?? null,
  tax_id: row.tax_id ?? row.nic ?? null,
});

export const customerService = {
  async list(): Promise<CustomerListResult> {
    const { data } = await apiClient.get<
      ApiSuccessResponse<CustomerSummary[]> & {
        summary?: CustomerListResult['summary'];
        filters?: CustomerListResult['filters'];
      }
    >('/customers');

    if (!data.success) {
      throw new Error(data.message ?? 'Failed to load customers');
    }

    const customers = (data.data ?? []).map(normalizeCustomer);
    const summary = data.summary ?? {
      total_customers: customers.length,
      debtor_count: customers.filter(c => (c.net_balance ?? 0) > 0).length,
      total_receivables: customers.reduce(
        (sum, c) => sum + Math.max(0, c.net_balance ?? 0),
        0,
      ),
    };

    return {
      customers,
      summary: {
        total_customers: summary.total_customers ?? customers.length,
        debtor_count:
          summary.debtor_count ??
          customers.filter(c => (c.net_balance ?? 0) > 0).length,
        total_receivables: summary.total_receivables ?? 0,
      },
      filters: data.filters ?? { locations: [] },
    };
  },

  async get(id: number): Promise<CustomerSummary> {
    const { data } = await apiClient.get<ApiSuccessResponse<CustomerSummary>>(
      `/customers/${id}`,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Customer not found');
    }
    return normalizeCustomer(data.data);
  },

  async create(payload: CustomerPayload): Promise<CustomerSummary> {
    const { data } = await apiClient.post<ApiSuccessResponse<CustomerSummary>>(
      '/customers',
      payload,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to save customer');
    }
    return normalizeCustomer(data.data);
  },

  async update(
    id: number,
    payload: Partial<CustomerPayload>,
  ): Promise<CustomerSummary> {
    const { data } = await apiClient.put<ApiSuccessResponse<CustomerSummary>>(
      `/customers/${id}`,
      payload,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to update customer');
    }
    return normalizeCustomer(data.data);
  },

  async receivePayment(
    id: number,
    payload: ReceivePaymentPayload,
  ): Promise<ReceivePaymentResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<ReceivePaymentResult>>(
      `/customers/${id}/receive-payment`,
      payload,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to record payment');
    }
    return {
      ...data.data,
      customer: normalizeCustomer(data.data.customer),
    };
  },

  /** That customer's still-unpaid credit bills, oldest first — for the
   * Receive Payment "which bill" picker. */
  async outstandingBills(id: number): Promise<OutstandingBill[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<OutstandingBill[]>>(
      `/customers/${id}/outstanding-bills`,
    );
    if (!data.success) {
      throw new Error(data.message ?? 'Failed to load outstanding bills');
    }
    return data.data ?? [];
  },

  /** "Receive payment" records for a customer — for Customer History, which
   * otherwise only lists their sales. */
  async payments(id: number): Promise<CustomerPaymentRecord[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<CustomerPaymentRecord[]>>(
      `/customers/${id}/payments`,
    );
    if (!data.success) {
      throw new Error(data.message ?? 'Failed to load customer payments');
    }
    return data.data ?? [];
  },

  /** Marks a payment as returned (e.g. a bounced cheque) — reverses it:
   * restores the customer's balance and frees up whichever bill it was
   * allocated to, if any. */
  async returnPayment(id: number, paymentId: number): Promise<ChequeReturnResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<ChequeReturnResult>>(
      `/customers/${id}/payments/${paymentId}/return`,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to mark payment as returned');
    }
    return { ...data.data, customer: normalizeCustomer(data.data.customer) };
  },

  /** Marks a sale-time cheque as returned (bounced) — the sale itself
   * (items, inventory, totals) is untouched; only its amount is added back
   * to the customer's balance as credit owed. */
  async returnSaleCheque(id: number, saleId: number): Promise<ChequeReturnResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<ChequeReturnResult>>(
      `/customers/${id}/sales/${saleId}/return-cheque`,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to mark cheque as returned');
    }
    return { ...data.data, customer: normalizeCustomer(data.data.customer) };
  },

  async remove(id: number): Promise<void> {
    const { data } = await apiClient.delete<ApiSuccessResponse<null>>(
      `/customers/${id}`,
    );
    if (!data.success) {
      throw new Error(data.message ?? 'Failed to delete customer');
    }
  },
};
