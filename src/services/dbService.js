import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase({ name: 'events.db', location: 'default' });

// ✅ Table banane ka function
export const createTables = () => {
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS checkpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT,
        category_id TEXT,
        checkpoint_id TEXT,
        checkpoint_name TEXT,
        checkpoint_point TEXT,
        latitude TEXT,
        longitude TEXT,
        sequence_number TEXT,
        description TEXT,
        synced INTEGER,
        time_stamp TEXT,
        status TEXT,
        over_speed INTEGER DEFAULT 0
      );`
    );
  });
};

// ✅ Checkpoint save karo (offline bhi hoga) - Only if not already exists
export const saveCheckpoint = (checkpoint) => {
  db.transaction(tx => {
    // First check if checkpoint already exists for this event
    tx.executeSql(
      `SELECT COUNT(*) as count FROM checkpoints WHERE checkpoint_id = ? AND event_id = ?`,
      [checkpoint.checkpoint_id, checkpoint.event_id],
      (txObj, result) => {
        const count = result.rows.item(0).count;
        if (count === 0) {
          // Checkpoint doesn't exist, insert new record
          tx.executeSql(
            `INSERT INTO checkpoints (
              event_id, category_id, checkpoint_id, checkpoint_name, checkpoint_point, latitude, longitude, sequence_number, description, synced, time_stamp, status, over_speed
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              checkpoint.event_id,
              checkpoint.category_id,
              checkpoint.checkpoint_id,
              checkpoint.checkpoint_name,
              checkpoint.checkpoint_point,
              checkpoint.latitude,
              checkpoint.longitude,
              checkpoint.sequence_number,
              checkpoint.description,
              0,
              checkpoint.time_stamp || '',
              checkpoint.status || 'not completed',
              checkpoint.over_speed || 0
            ]
          );
        } else {
          console.log(`🔄 [saveCheckpoint] Checkpoint "${checkpoint.checkpoint_id}" already exists in database - skipping insert`);
        }
      }
    );
  });
};

// ✅ Pending (unsynced) checkpoints fetch karo - Promise-based
export const getPendingCheckpoints = () => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM checkpoints WHERE synced = 0`,
        [],
        (txObj, { rows }) => {
          const result = [];
          for (let i = 0; i < rows.length; i++) {
            result.push(rows.item(i));
          }
          resolve(result);
        },
        (error) => {
          console.error('Error fetching pending checkpoints:', error);
          reject(error);
        }
      );
    });
  });
};

// ✅ Checkpoint ko synced mark karo - supports both id and checkpoint_id+event_id
export const markSynced = (id, event_id = null, checkpoint_id = null) => {
  db.transaction(tx => {
    if (event_id && checkpoint_id) {
      // Mark by checkpoint_id and event_id (more reliable for retry logic)
      tx.executeSql(
        `UPDATE checkpoints SET synced = 1 WHERE checkpoint_id = ? AND event_id = ?`,
        [checkpoint_id, event_id],
        () => console.log(`✅ Checkpoint ${checkpoint_id} marked as synced`),
        (error) => console.error('Error marking checkpoint as synced:', error)
      );
    } else {
      // Mark by id (legacy support)
      tx.executeSql(
        `UPDATE checkpoints SET synced = 1 WHERE id = ?`,
        [id],
        () => console.log(`✅ Checkpoint with id ${id} marked as synced`),
        (error) => console.error('Error marking checkpoint as synced:', error)
      );
    }
  });
};

// ✅ Checkpoint update karo (by checkpoint_id)
export const updateCheckpoint = (checkpoint) => {
  db.transaction(tx => {
    tx.executeSql(
      `UPDATE checkpoints SET 
        event_id = ?, category_id = ?, checkpoint_name = ?, checkpoint_point = ?, latitude = ?, longitude = ?, sequence_number = ?, description = ?, synced = ?
      WHERE checkpoint_id = ?`,
      [
        checkpoint.event_id,
        checkpoint.category_id,
        checkpoint.checkpoint_name,
        checkpoint.checkpoint_point,
        checkpoint.latitude,
        checkpoint.longitude,
        checkpoint.sequence_number,
        checkpoint.description,
        checkpoint.synced || 0,
        checkpoint.checkpoint_id
      ]
    );
  });
};

// ✅ Fetch checkpoint by checkpoint_id
export const getCheckpointById = (checkpoint_id, callback) => {
  db.transaction(tx => {
    tx.executeSql(
      `SELECT * FROM checkpoints WHERE checkpoint_id = ?`,
      [checkpoint_id],
      (txObj, { rows: { _array } }) => callback(_array && _array.length > 0 ? _array[0] : null)
    );
  });
};

// ✅ Get all completed checkpoints for a specific event
export const getCompletedCheckpointsForEvent = (event_id, callback) => {
  db.transaction(tx => {
    tx.executeSql(
      `SELECT * FROM checkpoints WHERE event_id = ? AND status = 'completed'`,
      [event_id],
      (txObj, { rows: { _array } }) => callback(_array || [])
    );
  });
};
