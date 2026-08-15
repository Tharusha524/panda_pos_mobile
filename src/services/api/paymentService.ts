import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/auth';
import type { PaymentDetailPayload } from '@/types/payments';

export const paymentService = {
  async getPayment(id: number): Promise<PaymentDetailPayload> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaymentDetailPayload>>(
      `/payments/${id}`,
    );
    if (!data.success || !data.data) {
      throw new Error(data.message ?? 'Failed to load payment');
    }
    return data.data;
  },
};
