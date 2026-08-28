import { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../utils/db';

// Polling intervals (ms)
const POLL_INTERVAL_ACTIVE = 30000;  // 30s when tab is visible
const POLL_INTERVAL_HIDDEN = 120000; // 2min when tab is in background

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

    const scheduleNext = () => {
      const delay = document.hidden ? POLL_INTERVAL_HIDDEN : POLL_INTERVAL_ACTIVE;
      timerId = setTimeout(fetchData, delay);
    };

    const fetchData = async () => {
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
        // Silently catch network errors
      } finally {
        isFetchingRef.current = false;
        if (isMounted) {
          setIsInitialLoading(false);
          scheduleNext();
        }
      }
    };

    fetchData(); // Initial load

    const handleImmediateUpdate = () => {
      // Triggered after local actions (register, scan, etc.)
      if (!isFetchingRef.current) {
        if (timerId) clearTimeout(timerId);
        fetchData();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !isFetchingRef.current) {
        // Tab became visible again - refresh immediately
        if (timerId) clearTimeout(timerId);
        fetchData();
      }
    };

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
