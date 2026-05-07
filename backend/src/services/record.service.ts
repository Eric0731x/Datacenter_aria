import { ActivityRecord } from '../models';
import { settleRewards } from './settlement.service';
import { sequelize } from '../models';

export interface ListRecordsQuery {
  page: number;
  pageSize: number;
  member_id?: string;
  activity_id?: string;
  audit_status?: string;
}

export async function getMyRecords(
  memberId: string,
  query: { page: number; pageSize: number }
): Promise<{ rows: InstanceType<typeof ActivityRecord>[]; count: number }> {
  const { page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  const { rows, count } = await ActivityRecord.findAndCountAll({
    where: { member_id: memberId },
    order: [['submit_time', 'DESC']],
    limit: pageSize,
    offset,
  });

  return { rows, count };
}

export async function getPendingRecords(
  query: { page: number; pageSize: number }
): Promise<{ rows: InstanceType<typeof ActivityRecord>[]; count: number }> {
  const { page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  const { rows, count } = await ActivityRecord.findAndCountAll({
    where: { audit_status: 'pending' },
    order: [['submit_time', 'ASC']],
    limit: pageSize,
    offset,
  });

  return { rows, count };
}

export async function auditRecord(
  recordId: string,
  auditorId: string,
  action: 'approve' | 'reject',
  remark?: string
): Promise<InstanceType<typeof ActivityRecord>> {
  return sequelize.transaction(async (t) => {
    const record = await ActivityRecord.findByPk(recordId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!record) {
      throw Object.assign(new Error('Record not found'), { code: 1004, statusCode: 404 });
    }
    if (record.audit_status !== 'pending') {
      throw Object.assign(new Error('Record is not in pending status'), {
        code: 3011,
        statusCode: 400,
      });
    }

    record.audit_status = action === 'approve' ? 'approved' : 'rejected';
    record.auditor_id = auditorId;
    record.audit_time = new Date();
    record.audit_remark = remark || null;
    await record.save({ transaction: t });

    if (record.audit_status === 'approved') {
      await settleRewards(record.member_id, record.activity_id, recordId, t);
    }

    return record;
  });
}
