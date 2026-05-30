import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type ActivityType = 'expense_added' | 'expense_edited' | 'member_added' | 'payment_added';

export async function logActivity(
  groupId: string,
  type: ActivityType,
  text: string,
) {
  await addDoc(collection(db, 'groups', groupId, 'activities'), {
    type,
    text,
    createdAt: serverTimestamp(),
  });
}
