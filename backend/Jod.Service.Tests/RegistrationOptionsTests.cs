using Jod.Service.Options;

namespace Jod.Service.Tests;

public class RegistrationOptionsTests
{
    [Fact]
    public void Mode_WhenNotConfigured_IsClosed()
    {
        // Act
        var options = new RegistrationOptions();

        // Assert
        Assert.Equal(RegistrationMode.Closed, options.Mode);
    }
}
