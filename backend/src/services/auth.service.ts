import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Member } from '../models';
import { generateId } from '../utils/uuid';
import { JwtPayload } from '../middlewares/auth.middleware';

const BCRYPT_ROUNDS = 10;

export interface RegisterInput {
  email: string;
  password: string;
  nickname: string;
  phone?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

function signToken(member: InstanceType<typeof Member>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  const payload: JwtPayload = {
    member_id: member.member_id,
    email: member.email,
    role: member.role,
  };

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export async function register(input: RegisterInput): Promise<{ member: InstanceType<typeof Member>; token: string }> {
  const existing = await Member.findOne({ where: { email: input.email } });
  if (existing) {
    throw Object.assign(new Error('Email already registered'), { code: 3001, statusCode: 400 });
  }

  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const member = await Member.create({
    member_id: generateId(),
    email: input.email,
    nickname: input.nickname,
    phone: input.phone || null,
    password: hashedPassword,
  });

  const token = signToken(member);
  return { member, token };
}

export async function login(input: LoginInput): Promise<{ member: InstanceType<typeof Member>; token: string }> {
  const member = await Member.findOne({ where: { email: input.email } });
  if (!member) {
    throw Object.assign(new Error('Invalid email or password'), { code: 3002, statusCode: 401 });
  }

  const valid = await bcrypt.compare(input.password, member.password);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { code: 3002, statusCode: 401 });
  }

  if (member.member_status === 'frozen') {
    throw Object.assign(new Error('Account is frozen'), { code: 3008, statusCode: 403 });
  }

  const token = signToken(member);
  return { member, token };
}

export async function getMe(member_id: string): Promise<InstanceType<typeof Member>> {
  const member = await Member.findByPk(member_id);
  if (!member) {
    throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
  }
  return member;
}
