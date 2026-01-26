const ActivityTracker = require('../models/ActivityTracker');
const UserNotificationStatus = require('../models/UserNotificationStatus');

const generateTitle = (type, details) => {
  switch (type) {
    case 'user_added': return 'New User Added';
    case 'user_deleted': return 'User Deleted';
    case 'user_counterid_updated': return 'User CounterId Updated';
    case 'student_added': return 'New Student Added';
    case 'student_deleted': return 'Student Deleted';
    case 'role_added': return 'New Role Added';
    case 'role_deleted': return 'Role Deleted';
    default: return 'Activity';
  }
};

const generateDescription = (type, details) => {
  switch (type) {
    case 'user_added':
      const userIdentifier = details.username || details.user_id || 'Unknown';
      return `User ${userIdentifier} was added`;
    case 'user_deleted':
      const deletedUserIdentifier = details.username || details.user_id || 'Unknown';
      return `User ${deletedUserIdentifier} was deleted`;
    case 'user_counterid_updated':
      return `User ${details.user_id}'s CounterId updated from ${details.oldCounterId} to ${details.newCounterId}`;
    case 'student_added':
      return `Student ${details.student_id} was added`;
    case 'student_deleted':
      return `Student ${details.student_id} was deleted`;
    case 'role_added':
      return `Role ${details.roleName} was added`;
    case 'role_deleted':
      return `Role ${details.roleName} was deleted`;
    default:
      return 'Activity occurred';
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    const notifications = await ActivityTracker.findAll({
      include: [{
        model: UserNotificationStatus,
        where: { user_id: userId },
        required: false
      }],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const formattedNotifications = notifications.map(activity => {
      const status = activity.UserNotificationStatus || { is_read: false, is_cleared: false };
      return {
        id: activity.id,
        title: generateTitle(activity.activity_type, activity.details),
        description: generateDescription(activity.activity_type, activity.details),
        time: activity.created_at,
        isRead: status.is_read,
        isCleared: status.is_cleared,
        type: activity.activity_type
      };
    }).filter(n => !n.isCleared);

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    let status = await UserNotificationStatus.findOne({ where: { user_id: userId, activity_id: activityId } });
    if (!status) {
      status = await UserNotificationStatus.create({ user_id: userId, activity_id: activityId, is_read: true });
    } else {
      status.is_read = true;
      await status.save();
    }
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

const clearNotification = async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    let status = await UserNotificationStatus.findOne({ where: { user_id: userId, activity_id: activityId } });
    if (!status) {
      status = await UserNotificationStatus.create({ user_id: userId, activity_id: activityId, is_cleared: true });
    } else {
      status.is_cleared = true;
      await status.save();
    }
    res.json({ message: 'Notification cleared' });
  } catch (error) {
    console.error('Error clearing notification:', error);
    res.status(500).json({ message: 'Failed to clear notification' });
  }
};

const markNotificationsAsRead = async (req, res) => {
  try {
    const { activityIds } = req.body;
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    for (const activityId of activityIds) {
      let status = await UserNotificationStatus.findOne({ where: { user_id: userId, activity_id: activityId } });
      if (!status) {
        await UserNotificationStatus.create({ user_id: userId, activity_id: activityId, is_read: true });
      } else {
        status.is_read = true;
        await status.save();
      }
    }
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
};

const clearNotifications = async (req, res) => {
  try {
    const { activityIds } = req.body;
    const userId = req.user.userId || req.user.id;
    if (!userId) {
      throw new Error('User ID not found in token');
    }
    for (const activityId of activityIds) {
      let status = await UserNotificationStatus.findOne({ where: { user_id: userId, activity_id: activityId } });
      if (!status) {
        await UserNotificationStatus.create({ user_id: userId, activity_id: activityId, is_cleared: true });
      } else {
        status.is_cleared = true;
        await status.save();
      }
    }
    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ message: 'Failed to clear notifications' });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  clearNotification,
  markNotificationsAsRead,
  clearNotifications
};
