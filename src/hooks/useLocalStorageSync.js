import { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../utils/db';

export const useLocalStorageSync = () => {
  const [teams, setTeams] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [scans, setScans] = useState([]);
  const [events, setEvents] = useState([]);
  const [pointsActive, setPointsActive] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const fetchData = async () => {
      // Pause polling if user switched away to another tab
      if (document.hidden) {
        timerId = setTimeout(fetchData, 2000);
        return;
      }

      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        const res = await fetch(getApiUrl('/api/data'));
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setTeams(data.teams || []);
            setVisitors(data.visitors || []);
            setFaculty(data.faculty || []);
            setScans(data.scans || []);
            setEvents(data.events || []);
            if (data.pointsActive !== undefined) {
              setPointsActive(Boolean(data.pointsActive));
            }
          }
        }
      } catch (err) {
        // Silently catch to avoid flood
      } finally {
        isFetchingRef.current = false;
        if (isMounted) {
          setIsInitialLoading(false);
          // Wait 2 seconds between completions
          timerId = setTimeout(fetchData, 2000);
        }
      }
    };

    fetchData(); // Initial run

    const handleImmediateUpdate = () => {
      if (!isFetchingRef.current) {
        if (timerId) clearTimeout(timerId);
        fetchData();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !isFetchingRef.current) {
        if (timerId) clearTimeout(timerId);
        fetchData();
      }
    };

    // Custom event listener for immediate updates on local modifications
    window.addEventListener('local-db-update', handleImmediateUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('local-db-update', handleImmediateUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { teams, visitors, faculty, scans, events, pointsActive, isInitialLoading };
};

