import { Redirect } from 'expo-router';

import StorageCheck from '@/dev/storage-check';

export default function StorageCheckRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <StorageCheck />;
}
