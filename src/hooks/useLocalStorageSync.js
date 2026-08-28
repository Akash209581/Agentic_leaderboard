import { useState, useEffect } from 'react';

export const useLocalStorageSync = () => {
  const [teams, setTeams] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [scans, setScans] = useState([]);
  const [events, setEvents] = useState([]);
  const [pointsActive, setPointsActive] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams || []);
          setVisitors(data.visitors || []);
          setFaculty(data.faculty || []);
          setScans(data.scans || []);
          setEvents(data.events || []);
          if (data.pointsActive !== undefined) {
            setPointsActive(Boolean(data.pointsActive));
          }
        }
      } catch (err) {
        console.error('Failed to sync data from server database', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchData(); // Initial run
    
    // Poll every 2 seconds for real-time scanner code approvals and scoreboard changes
    const interval = setInterval(fetchData, 2000);

    // Custom event listener for immediate updates on local modifications
    window.addEventListener('local-db-update', fetchData);

    return () => {
      clearInterval(interval);
      window.removeEventListener('local-db-update', fetchData);
    };
  }, []);

  return { teams, visitors, faculty, scans, events, pointsActive, isInitialLoading };
};

