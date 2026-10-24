import Notification from "../models/Notification.js";

const notify = async (userId, title, message, link) => {
  if (!userId) return;
  await Notification.create({ user: userId, title, message, link });
};
const notifyMany = async (userIds, title, message, link) => {
  if (!userIds.length) return;
  await Notification.insertMany(userIds.map((user) => ({ user, title, message, link })));
};
export { notify, notifyMany };
