export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toDateString();
}

// Format date and time separately for events
export function formatEventDateTime(dateTimeString) {
  if (!dateTimeString) {
    return { date: '', time: '' };
  }

  // Handle different date formats
  let date;
  
  // Check if it contains time (has space or T separator)
  if (dateTimeString.includes(' ') || dateTimeString.includes('T')) {
    // Full datetime string
    date = new Date(dateTimeString.replace(' ', 'T'));
  } else {
    // Date only string
    date = new Date(dateTimeString);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return { date: dateTimeString, time: '' };
  }

  // Format date as DD/MM/YYYY
  const formattedDate = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Format time as HH:MM AM/PM (only if time exists)
  let formattedTime = '';
  if (dateTimeString.includes(' ') || dateTimeString.includes('T')) {
    formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  return {
    date: formattedDate,
    time: formattedTime
  };
}

// Format both start and end date/time for events
export function formatEventStartEndDateTime(startDateTime, endDateTime) {
  const start = formatEventDateTime(startDateTime);
  const end = formatEventDateTime(endDateTime);
  
  return {
    startTime: start.time,
    startDate: start.date,
    endTime: end.time,
    endDate: end.date
  };
}
