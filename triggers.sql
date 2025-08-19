DROP TRIGGER IF EXISTS trg_PunchLog_before_insert;
DROP TRIGGER IF EXISTS trg_PunchLog_before_update;

DELIMITER $$
CREATE TRIGGER trg_PunchLog_before_insert
BEFORE INSERT ON PunchLog
FOR EACH ROW
BEGIN
  IF NEW.PunchTime < (NOW() - INTERVAL 1 MINUTE) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Insertion rejected: PunchTime is older than 1 minute';
  END IF;
END$$

CREATE TRIGGER trg_PunchLog_before_update
BEFORE UPDATE ON PunchLog
FOR EACH ROW
BEGIN
  IF NEW.PunchTime < (NOW() - INTERVAL 1 MINUTE) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Update rejected: PunchTime is older than 1 minute';
  END IF;
END$$
DELIMITER ;
