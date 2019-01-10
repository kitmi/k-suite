<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="">
    <meta name="author" content="">
    <link rel="icon" href="{{ _makePath('favicon.ico') }}">

    <title>LEVO SSO - User Login</title>

    <script type="text/javascript" src="{{ _makePath('js/jquery.min.js') }}"></script>

    <!-- Bootstrap core CSS -->
    <link href="{{ _makePath('css/bootstrap.min.css') }}" rel="stylesheet">

    <script type="text/javascript" src="{{ _makePath('js/bootstrap.bundle.min.js') }}"></script>

    <!-- Custom styles for this page -->
    <link href="{{ _makePath('css/user-login.css') }}" rel="stylesheet">
  </head>

  <body class="text-center">  
    <form class="form-signin" method="post" action="{{ _self }}">
      <input type="hidden" name="_csrf" value="{{ _csrf }}" /> 
      
      <h1 class="h3 mb-3 font-weight-normal">Please sign in</h1>
      {% if error %}
      <div class="alert alert-danger" role="alert">
        {{ error }}
      </div>  
      {% endif %}
      <label for="inputUsername" class="sr-only">Email or mobile</label>
      <input type="text" id="inputUsername" name="username" class="form-control" placeholder="Email or mobile" required autofocus>
      <label for="inputPassword" class="sr-only">Password</label>
      <input type="password" id="inputPassword" name="password" class="form-control" placeholder="Password" required>
      <div class="checkbox mb-3">
        <label>
          <input type="checkbox" value="remember-me"> Remember me
        </label>
      </div>
      <button class="btn btn-lg btn-primary btn-block" type="submit">Sign in</button>
      <p class="mt-5 mb-3 text-muted">&copy; 2017-2018</p>
    </form>
  </body>
</html>