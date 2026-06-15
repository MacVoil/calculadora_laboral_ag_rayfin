import { AuthError } from '@microsoft/rayfin-client';

import { getGlobalSessionExpiredHandler } from '@/hooks/AuthContext';

import { getRayfinClient } from './rayfinClient';

export interface CalculationItem {
  id: string;
  name: string;
  salary: number;
  smmlv: number;
  auxTransport: number;
  isIntegral: boolean;
  arlClass: number;
  isExempt: boolean;
  createdAt: Date;
}

function handleError(err: unknown): never {
  const isAuthError =
    err instanceof AuthError ||
    (err instanceof Error && 'status' in err && (err as { status: number }).status === 401);

  if (isAuthError) {
    const handler = getGlobalSessionExpiredHandler();
    if (handler) handler();
  }
  throw err;
}

export async function getCalculations(): Promise<CalculationItem[]> {
  try {
    const client = getRayfinClient();
    const results = await client.data.Calculation.select([
      'id',
      'name',
      'salary',
      'smmlv',
      'auxTransport',
      'isIntegral',
      'arlClass',
      'isExempt',
      'createdAt',
    ])
      .orderBy({ createdAt: 'desc' })
      .execute();
    return results as CalculationItem[];
  } catch (err) {
    handleError(err);
  }
}

export async function createCalculation(data: {
  name: string;
  salary: number;
  smmlv: number;
  auxTransport: number;
  isIntegral: boolean;
  arlClass: number;
  isExempt: boolean;
}): Promise<CalculationItem> {
  try {
    const client = getRayfinClient();
    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user) {
      throw new Error('Cannot save calculation: user is not authenticated.');
    }
    const calculation = await client.data.Calculation.create({
      name: data.name,
      salary: data.salary,
      smmlv: data.smmlv,
      auxTransport: data.auxTransport,
      isIntegral: data.isIntegral,
      arlClass: data.arlClass,
      isExempt: data.isExempt,
      createdAt: new Date(),
      user_id: session.user.id,
    });
    return calculation as CalculationItem;
  } catch (err) {
    handleError(err);
  }
}

export async function deleteCalculation(id: string): Promise<void> {
  try {
    const client = getRayfinClient();
    await client.data.Calculation.delete({ id });
  } catch (err) {
    handleError(err);
  }
}
