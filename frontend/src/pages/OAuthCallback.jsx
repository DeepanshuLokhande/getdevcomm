import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { setAuthToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setAuthToken(token);
      // After setting token, navigate to home (user will be loaded by AuthContext)
      navigate('/', { replace: true });
    } else {
      // No token found; navigate to home
      navigate('/', { replace: true });
    }
  }, [navigate, setAuthToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-bg">
      <div className="text-gray-700 dark:text-gray-300">Signing you in...</div>
    </div>
  );
};

export default OAuthCallback;
