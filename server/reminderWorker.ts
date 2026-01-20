import { storage } from "./storage";
import { sendTrialExpiryReminderEmail, sendSubscriptionExpiryReminderEmail } from "./email";
import type { SubscriptionReminder, Tenant } from "@shared/schema";

const REMINDER_CHECK_INTERVAL = 60 * 60 * 1000;

async function processTrialReminder(reminder: SubscriptionReminder, tenant: Tenant): Promise<boolean> {
  const expiryDateFormatted = new Date(reminder.expiryDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const recipientEmail = reminder.emailTo || tenant.contactEmail;
  if (!recipientEmail) {
    console.error(`Reminder ${reminder.id}: No email address available`);
    return false;
  }

  const success = await sendTrialExpiryReminderEmail(
    recipientEmail,
    tenant.name,
    expiryDateFormatted,
    reminder.daysBeforeExpiry
  );

  return success;
}

async function processSubscriptionReminder(reminder: SubscriptionReminder, tenant: Tenant): Promise<boolean> {
  const expiryDateFormatted = new Date(reminder.expiryDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const recipientEmail = reminder.emailTo || tenant.contactEmail;
  if (!recipientEmail) {
    console.error(`Reminder ${reminder.id}: No email address available`);
    return false;
  }

  const plan = tenant.subscriptionPlanId 
    ? await storage.getSubscriptionPlanById(tenant.subscriptionPlanId)
    : null;
  const planName = plan?.name || "Abonnement";

  const success = await sendSubscriptionExpiryReminderEmail(
    recipientEmail,
    tenant.name,
    expiryDateFormatted,
    reminder.daysBeforeExpiry,
    planName
  );

  return success;
}

async function processReminder(reminder: SubscriptionReminder): Promise<void> {
  try {
    const tenant = await storage.getTenantById(reminder.tenantId);
    if (!tenant) {
      console.error(`Reminder ${reminder.id}: Tenant not found`);
      await storage.updateSubscriptionReminder(reminder.id, {
        status: "CANCELLED",
        lastError: "Tenant not found"
      });
      return;
    }

    if (tenant.lifecycleStatus === "ARCHIVED") {
      console.log(`Reminder ${reminder.id}: Tenant is archived, cancelling`);
      await storage.updateSubscriptionReminder(reminder.id, {
        status: "CANCELLED",
        lastError: "Tenant archived"
      });
      return;
    }

    let success = false;
    if (reminder.reminderContext === "TRIAL") {
      success = await processTrialReminder(reminder, tenant);
    } else {
      success = await processSubscriptionReminder(reminder, tenant);
    }

    if (success) {
      await storage.updateSubscriptionReminder(reminder.id, {
        status: "SENT",
        sentAt: new Date()
      });
      console.log(`Reminder ${reminder.id} sent successfully to ${reminder.emailTo || tenant.contactEmail}`);
    } else {
      const newRetryCount = (reminder.retryCount || 0) + 1;
      if (newRetryCount >= 3) {
        await storage.updateSubscriptionReminder(reminder.id, {
          status: "FAILED",
          retryCount: newRetryCount,
          lastError: "Max retries exceeded"
        });
        console.error(`Reminder ${reminder.id}: Max retries exceeded`);
      } else {
        await storage.updateSubscriptionReminder(reminder.id, {
          retryCount: newRetryCount,
          lastError: "Email sending failed"
        });
        console.warn(`Reminder ${reminder.id}: Retry ${newRetryCount}/3`);
      }
    }
  } catch (error: any) {
    console.error(`Error processing reminder ${reminder.id}:`, error);
    const newRetryCount = (reminder.retryCount || 0) + 1;
    if (newRetryCount >= 3) {
      await storage.updateSubscriptionReminder(reminder.id, {
        status: "FAILED",
        retryCount: newRetryCount,
        lastError: error.message || "Unknown error"
      });
      console.error(`Reminder ${reminder.id}: Max retries exceeded after exception`);
    } else {
      await storage.updateSubscriptionReminder(reminder.id, {
        retryCount: newRetryCount,
        lastError: error.message || "Unknown error"
      });
      console.warn(`Reminder ${reminder.id}: Exception, retry ${newRetryCount}/3`);
    }
  }
}

async function scheduleRemindersForAllTenants(): Promise<void> {
  try {
    const allTenants = await storage.getAllTenants();
    
    for (const tenant of allTenants) {
      if (tenant.lifecycleStatus === "ARCHIVED") continue;
      if (!tenant.contactEmail) continue;

      if (tenant.billingStatus === "TRIAL" && tenant.trialEndsAt) {
        const trialEnd = new Date(tenant.trialEndsAt);
        if (trialEnd > new Date()) {
          await storage.scheduleSubscriptionReminders(
            tenant.id,
            trialEnd,
            "TRIAL",
            tenant.contactEmail
          );
        }
      }

      if (tenant.billingStatus === "ACTIVE") {
        const mandateSubscription = await storage.getActiveMandateSubscription(tenant.id);
        if (mandateSubscription && mandateSubscription.endDate) {
          const endDate = new Date(mandateSubscription.endDate);
          if (endDate > new Date()) {
            await storage.scheduleSubscriptionReminders(
              tenant.id,
              endDate,
              "SUBSCRIPTION",
              tenant.contactEmail
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error scheduling reminders for tenants:", error);
  }
}

async function processPendingReminders(): Promise<void> {
  try {
    const pendingReminders = await storage.getPendingSubscriptionReminders();
    
    if (pendingReminders.length > 0) {
      console.log(`Processing ${pendingReminders.length} pending reminders...`);
    }

    for (const reminder of pendingReminders) {
      await processReminder(reminder);
    }
  } catch (error) {
    console.error("Error processing pending reminders:", error);
  }
}

async function runReminderWorker(): Promise<void> {
  console.log("Starting reminder worker...");
  
  await scheduleRemindersForAllTenants();
  await processPendingReminders();
  
  setInterval(async () => {
    console.log("Running reminder worker check...");
    await scheduleRemindersForAllTenants();
    await processPendingReminders();
  }, REMINDER_CHECK_INTERVAL);
}

export { runReminderWorker, processPendingReminders, scheduleRemindersForAllTenants };
