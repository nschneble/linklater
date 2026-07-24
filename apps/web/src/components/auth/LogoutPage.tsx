import { useAuth } from '../../auth/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return null;
}
