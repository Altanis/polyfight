use tokio::{
    sync::{
        Mutex as AsyncMutex,
        MutexGuard as AsyncMutexGuard,
    },
    time::{
        timeout,
        Duration as AsyncDuration,
    },
};

#[async_trait::async_trait]

/// A timed mutex trait for Tokio mutices.
pub trait AsyncTimedLock<T>
{
    async fn lock_with_timeout(&self) -> AsyncMutexGuard<'_, T>;
}

#[async_trait::async_trait]
impl<T> AsyncTimedLock<T> for AsyncMutex<T>
where
    T: Send,
{
    async fn lock_with_timeout(&self) -> AsyncMutexGuard<'_, T>
    {
        self.lock().await
        // match timeout(AsyncDuration::from_secs(5), self.lock()).await
        // {
        //     Ok(guard) => guard,
        //     Err(_) => panic!("Failed to acquire lock within timeout"),
        // }
    }
}
