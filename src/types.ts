export interface Group {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
}

export interface Member {
  id: string;
  name: string;
  upiId?: string;
  createdAt: Date;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidByMemberId: string;
  date: Date;
  category?: string;
  splitAmong: string[];
  splits?: Record<string, number>; // custom split: memberId → amount
}

export interface Payment {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: Date;
}

export interface Balance {
  memberId: string;
  memberName: string;
  net: number;
}

export interface Settlement {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface RecentGroup {
  id: string;
  name: string;
  visitedAt: string;
}
