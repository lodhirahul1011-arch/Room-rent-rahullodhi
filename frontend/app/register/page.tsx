import {LIVE_MODE} from '@/services/live/api';
import {LiveAuth} from '@/features/live/live-auth';
import { AuthScreen } from '@/components/auth-screen';

export default function RegisterPage() {
  return LIVE_MODE?<LiveAuth mode="register"/>:<AuthScreen mode="register"/>;
}
