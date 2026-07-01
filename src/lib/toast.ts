import toast from 'react-hot-toast';

export const notify = {
  success: (m: string) => toast.success(m),
  error: (m: string) => toast.error(m),
  info: (m: string) => toast(m),
  loading: (m: string) => toast.loading(m),
  promise: toast.promise,
  dismiss: toast.dismiss,
};
